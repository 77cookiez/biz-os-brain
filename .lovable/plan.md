

# Team Chat Complete Fix Plan

## Root Cause (Confirmed from DB Logs)

The database logs show **repeated `infinite recursion detected in policy for relation "chat_thread_members"`** errors. This is the single root cause breaking the entire chat system.

Here is what happens:

1. The `chat_threads` SELECT policy calls `is_chat_thread_member(auth.uid(), id)` -- this queries `chat_thread_members`
2. The `chat_thread_members` SELECT policy calls `is_chat_thread_member(auth.uid(), thread_id)` -- this queries `chat_thread_members` AGAIN
3. This creates an infinite loop, and the database rejects ALL queries touching these tables

This means:
- Thread list returns empty (no threads visible)
- New Thread dialog returns empty (the query to fetch workspace members works, but thread creation fails because inserting into `chat_thread_members` triggers the recursive SELECT check)
- No messages can be loaded

The "No other workspace members found" issue seen earlier is a separate symptom -- it occurs when there is only one active user in the workspace, which is the current case (only 2 accepted members: `7d0163d8` and `9f41f9a4`).

## Fix Plan

### Step 1: Fix RLS Policies (Database Migration)

Drop and recreate the recursive policies with simple, non-recursive versions:

**`chat_thread_members` SELECT policy** -- Replace the recursive call with a direct `user_id = auth.uid()` check. A user should be able to see their own memberships without needing to call a function that queries the same table:

```sql
DROP POLICY "Thread members can view membership" ON chat_thread_members;
CREATE POLICY "Thread members can view membership" 
  ON chat_thread_members FOR SELECT
  USING (user_id = auth.uid());
```

**`chat_threads` SELECT policy** -- Replace `is_chat_thread_member(auth.uid(), id)` with a direct EXISTS subquery against `chat_thread_members`. Since `chat_thread_members` now has a simple `user_id = auth.uid()` policy, this will NOT recurse:

```sql
DROP POLICY "Thread members can view their threads" ON chat_threads;
CREATE POLICY "Thread members can view their threads" 
  ON chat_threads FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id) 
    AND EXISTS (
      SELECT 1 FROM chat_thread_members 
      WHERE thread_id = chat_threads.id AND user_id = auth.uid()
    )
  );
```

**`chat_messages` SELECT policy** -- Same pattern, replace `is_chat_thread_member` call:

```sql
DROP POLICY "Thread members can view messages" ON chat_messages;
CREATE POLICY "Thread members can view messages" 
  ON chat_messages FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id) 
    AND EXISTS (
      SELECT 1 FROM chat_thread_members 
      WHERE thread_id = chat_messages.thread_id AND user_id = auth.uid()
    )
  );
```

Also fix the INSERT and DELETE policies on `chat_messages` and `chat_thread_members` that use `is_chat_thread_member()`:

```sql
-- chat_messages INSERT
DROP POLICY "Thread members can send messages" ON chat_messages;
CREATE POLICY "Thread members can send messages" 
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid() 
    AND is_workspace_member(auth.uid(), workspace_id) 
    AND EXISTS (
      SELECT 1 FROM chat_thread_members 
      WHERE thread_id = chat_messages.thread_id AND user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM meaning_objects 
      WHERE id = chat_messages.meaning_object_id 
      AND workspace_id = chat_messages.workspace_id
    )
  );

-- chat_messages DELETE  
DROP POLICY "Admins can delete messages" ON chat_messages;
CREATE POLICY "Admins can delete messages" 
  ON chat_messages FOR DELETE
  USING (
    is_workspace_member(auth.uid(), workspace_id) 
    AND (
      sender_user_id = auth.uid() 
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner') 
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin')
    )
  );
```

### Step 2: Fix NewThreadDialog Query (Code)

The current query uses a foreign-key join syntax that may not work correctly:
```typescript
.select('user_id, profiles:user_id(full_name)')
```

Replace with two separate queries -- first get workspace members, then fetch their profiles:

```typescript
// 1. Get workspace member user_ids
const { data: memberData } = await supabase
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', currentWorkspace.id);

const memberIds = (memberData || [])
  .map(m => m.user_id)
  .filter(id => id !== user?.id);

if (memberIds.length === 0) { setMembers([]); return; }

// 2. Fetch profiles for those users
const { data: profileData } = await supabase
  .from('profiles')
  .select('user_id, full_name')
  .in('user_id', memberIds);

const list = memberIds.map(uid => ({
  user_id: uid,
  profile: profileData?.find(p => p.user_id === uid) || null,
}));
setMembers(list);
```

### Step 3: Fix useChatThreads Thread Visibility

The `useChatThreads` hook queries `chat_threads` which now depends on the user being a thread member. For newly created threads, the current code inserts the thread first, then adds members. This means the SELECT after insert might fail. Fix the `createThread` function to handle this ordering correctly and optimistically add the new thread to state.

### Files to Modify

| File | Change |
|------|--------|
| New SQL migration | Drop and recreate 6 RLS policies to eliminate recursion |
| `src/components/chat/NewThreadDialog.tsx` | Fix member fetching with separate queries |
| `src/hooks/useChatThreads.ts` | Improve createThread to handle RLS timing |

### Expected Result After Fix

- Thread list shows existing conversations
- "New Conversation" dialog shows all workspace members (currently: NAWAF ALBUSAEEDI and pending members)
- Messages can be sent and received in threads
- No more "infinite recursion" errors in database logs


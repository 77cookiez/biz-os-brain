import { useEffect } from 'react';

interface DocumentMetaOptions {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  canonical?: string;
  twitterCard?: 'summary' | 'summary_large_image';
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentMeta(options: DocumentMetaOptions) {
  useEffect(() => {
    const prevTitle = document.title;

    if (options.title) {
      document.title = options.title;
    }
    if (options.description) {
      setMeta('description', options.description);
    }
    if (options.ogTitle || options.title) {
      setMeta('og:title', options.ogTitle || options.title || '', 'property');
    }
    if (options.ogDescription || options.description) {
      setMeta('og:description', options.ogDescription || options.description || '', 'property');
    }
    if (options.ogImage) {
      setMeta('og:image', options.ogImage, 'property');
    }
    if (options.ogUrl) {
      setMeta('og:url', options.ogUrl, 'property');
    }
    if (options.canonical) {
      setLink('canonical', options.canonical);
    }
    if (options.twitterCard) {
      setMeta('twitter:card', options.twitterCard);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [options.title, options.description, options.ogTitle, options.ogDescription, options.ogImage, options.ogUrl, options.canonical, options.twitterCard]);
}

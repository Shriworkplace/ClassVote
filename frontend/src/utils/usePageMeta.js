import { useEffect } from 'react';

function updateMetaTag(attrName, attrValue, content) {
  if (content === undefined || content === null) return;
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function updateLinkTag(rel, href) {
  if (!href) return;
  let element = document.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/**
 * Custom React hook for dynamic client-side SEO and page metadata.
 *
 * @param {Object} options
 * @param {string} [options.title] - Page title prefix (e.g. "Computer Science Election 2026")
 * @param {string} [options.description] - Meta description for search engines and social cards
 * @param {string} [options.robots] - 'index, follow' (default) or 'noindex, nofollow'
 * @param {string} [options.canonical] - Canonical URL override
 * @param {string} [options.ogType] - OpenGraph type ('website', 'article', etc.)
 * @param {string} [options.ogImage] - OpenGraph image URL
 */
export function usePageMeta({
  title,
  description,
  robots = 'index, follow',
  canonical,
  ogType = 'website',
  ogImage
} = {}) {
  useEffect(() => {
    // 1. Document Title
    const formattedTitle = title
      ? `${title} | ClassVote`
      : 'ClassVote — Fast, Secure Student & Campus Election Platform';
    document.title = formattedTitle;

    // 2. Primary Meta
    updateMetaTag('name', 'title', formattedTitle);
    if (description) {
      updateMetaTag('name', 'description', description);
    }
    updateMetaTag('name', 'robots', robots);

    // 3. OpenGraph Tags
    updateMetaTag('property', 'og:title', formattedTitle);
    if (description) {
      updateMetaTag('property', 'og:description', description);
    }
    updateMetaTag('property', 'og:type', ogType);
    updateMetaTag('property', 'og:url', canonical || window.location.href);
    if (ogImage) {
      updateMetaTag('property', 'og:image', ogImage);
    }

    // 4. Twitter Cards
    updateMetaTag('name', 'twitter:title', formattedTitle);
    if (description) {
      updateMetaTag('name', 'twitter:description', description);
    }
    if (ogImage) {
      updateMetaTag('name', 'twitter:image', ogImage);
    }

    // 5. Canonical Link
    const currentCanonical = canonical || `${window.location.origin}${window.location.pathname}`;
    updateLinkTag('canonical', currentCanonical);
  }, [title, description, robots, canonical, ogType, ogImage]);
}

export default usePageMeta;

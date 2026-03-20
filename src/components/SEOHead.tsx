import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  image?: string;
}

const BASE_URL = "https://id-preview--858d51da-a58b-476a-9077-00587451ff29.lovable.app";
const DEFAULT_IMAGE = "https://lovable.dev/opengraph-image-p98pqg.png";

export function SEOHead({ title, description, path, image }: SEOHeadProps) {
  const fullTitle = `${title} | Chess`;
  const url = `${BASE_URL}${path}`;
  const ogImage = image ?? DEFAULT_IMAGE;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", description);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:image", ogImage);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);

    return () => {
      document.title = "Chess — Your Portfolio Strategy";
    };
  }, [fullTitle, description, url, ogImage]);

  return null;
}

// src/components/SearchHighlight.tsx

interface SearchHighlightProps {
  text: string;
  highlight: string;
  className?: string;
}

export function SearchHighlight({
  text,
  highlight,
  className = ''
}: SearchHighlightProps) {
  if (!highlight.trim()) {
    return <span className={className}>{text}</span>;
  }

  // Escape special characters in the search term
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create a regular expression to match the search term (case insensitive)
  const regex = new RegExp(`(${escapedHighlight})`, 'gi');

  // Split the text by the regular expression
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-100 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
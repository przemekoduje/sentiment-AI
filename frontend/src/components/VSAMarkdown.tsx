"use client"

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { VSA_DICTIONARY } from '@/lib/vsaDictionary'
import VSATooltip from './VSATooltip'

interface VSAMarkdownProps {
  children: string
  className?: string
}

/**
 * VSAMarkdown: A specialized renderer that injects tooltips for technical VSA terms
 * found within the markdown content.
 */
export default function VSAMarkdown({ children, className }: VSAMarkdownProps) {
  
  // Custom renderer for text nodes to detect VSA terms
  const TextWithTooltips = ({ content }: { content: string }) => {
    if (!content || typeof content !== 'string') return <>{content}</>;

    // Sort terms by length (descending) to avoid partial matches (e.g., "SOW" matching before "SOME TERM")
    const sortedTerms = [...VSA_DICTIONARY].sort((a, b) => b.term.length - a.term.length);
    
    // Build a regex that matches any of the terms (case insensitive)
    // We use word boundaries \b to avoid matching terms inside other words
    const termPattern = sortedTerms.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(\\b(?:${termPattern})\\b)`, 'gi');

    const parts = content.split(regex);

    return (
      <>
        {parts.map((part, i) => {
          const matchedTerm = sortedTerms.find(
            t => t.term.toLowerCase() === part.toLowerCase()
          );

          if (matchedTerm) {
            return (
              <VSATooltip
                key={i}
                term={matchedTerm.term}
                definition={matchedTerm.definition}
                category={matchedTerm.category}
              >
                {part}
              </VSATooltip>
            );
          }

          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  // We override the 'text' rendering in ReactMarkdown if possible, 
  // but ReactMarkdown renders text as plain strings in most elements.
  // A more robust way is to use custom components for common blocks.

  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          // We can't directly override 'text' in all versions easily without remark plugins,
          // but we can override p, li, strong, etc.
          p: ({ children }) => <p>{mapChildren(children, TextWithTooltips)}</p>,
          li: ({ children }) => <li>{mapChildren(children, TextWithTooltips)}</li>,
          strong: ({ children }) => <strong>{mapChildren(children, TextWithTooltips)}</strong>,
          em: ({ children }) => <em>{mapChildren(children, TextWithTooltips)}</em>,
          h1: ({ children }) => <h1>{mapChildren(children, TextWithTooltips)}</h1>,
          h2: ({ children }) => <h2>{mapChildren(children, TextWithTooltips)}</h2>,
          h3: ({ children }) => <h3>{mapChildren(children, TextWithTooltips)}</h3>,
          h4: ({ children }) => <h4>{mapChildren(children, TextWithTooltips)}</h4>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Helper to recursively process children and apply tooltips to text nodes
 */
function mapChildren(children: any, TextComponent: any): any {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return <TextComponent content={child} />;
    }
    if (React.isValidElement(child) && (child.props as any).children) {
      return React.cloneElement(child, {
        children: mapChildren((child.props as any).children, TextComponent),
      } as any);
    }
    return child;
  });
}

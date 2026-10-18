import { useMemo } from 'react';
import type { ReactNode } from 'react';

import styles from './ArticleBody.module.css';
import { parseBlocks } from '../../core/blocks';
import type { Block, InlineNode } from '../../core/blocks';
import { highlight } from '../../core/highlight';
import type { CodeToken } from '../../core/highlight';

export interface ArticleBodyProps {
  /** O corpo cru, como o banco guarda — Markdown do subconjunto de `core/blocks.ts`. */
  readonly markdown: string;
}

function renderInline(nodes: readonly InlineNode[], key: string): ReactNode {
  return nodes.map((node, index) => {
    const childKey = `${key}-${String(index)}`;
    switch (node.type) {
      case 'text':
        return node.text;
      case 'strong':
        return <strong key={childKey}>{renderInline(node.children, childKey)}</strong>;
      case 'em':
        return <em key={childKey}>{renderInline(node.children, childKey)}</em>;
      case 'code':
        return (
          <code key={childKey} className={styles.inlineCode}>
            {node.text}
          </code>
        );
      case 'link':
        return (
          <a key={childKey} href={node.href} className={styles.link}>
            {renderInline(node.children, childKey)}
          </a>
        );
    }
  });
}

const TOKEN_CLASS: Record<Exclude<CodeToken['kind'], 'plain'>, string | undefined> = {
  keyword: styles.tokenKeyword,
  string: styles.tokenString,
  number: styles.tokenNumber,
  comment: styles.tokenComment,
};

function renderCode(code: string, language: string | null, key: string): ReactNode {
  return highlight(code, language).map((token, index) =>
    token.kind === 'plain' ? (
      token.text
    ) : (
      <span key={`${key}-${String(index)}`} className={TOKEN_CLASS[token.kind]}>
        {token.text}
      </span>
    ),
  );
}

function renderBlock(block: Block, key: string): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 2 ? 'h2' : 'h3';
      const className = block.level === 2 ? styles.heading2 : styles.heading3;
      return (
        <Tag key={key} className={className}>
          {renderInline(block.children, key)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={key} className={styles.paragraph}>
          {renderInline(block.children, key)}
        </p>
      );
    case 'quote':
      return (
        <blockquote key={key} className={styles.quote}>
          {renderInline(block.children, key)}
        </blockquote>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={key} className={styles.list}>
          {block.items.map((item, index) => (
            <li key={`${key}-${String(index)}`}>{renderInline(item, `${key}-${String(index)}`)}</li>
          ))}
        </Tag>
      );
    }
    case 'code':
      return (
        <pre key={key} className={styles.code}>
          {block.language !== null && <span className={styles.codeLang}>{block.language}</span>}
          <code className={styles.codeText}>{renderCode(block.code, block.language, key)}</code>
        </pre>
      );
    case 'image':
      return (
        <figure key={key} className={styles.figure}>
          <img className={styles.image} src={block.src} alt={block.alt} loading="lazy" />
          {block.caption !== null && <figcaption className={styles.caption}>{block.caption}</figcaption>}
        </figure>
      );
  }
}

/**
 * O corpo do artigo, desenhado uma vez só.
 *
 * `ArticlePage` (prerender, sem navegador) e `ReaderView` (overlay no
 * cliente) montavam cada um o seu próprio `body.map((p) => <p>{p}</p>)`. Este
 * componente é o que fecha essa duplicação: os dois passam a só montar
 * `<ArticleBody markdown={...} />`.
 */
export function ArticleBody({ markdown }: ArticleBodyProps) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);

  return (
    <>
      {blocks.map((block, index) => renderBlock(block, `block-${String(index)}`))}
    </>
  );
}

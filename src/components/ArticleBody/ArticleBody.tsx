import { useMemo } from 'react';
import type { ReactNode } from 'react';

import styles from './ArticleBody.module.css';
import { parseBlocks } from '../../core/blocks';
import type { Block, InlineNode } from '../../core/blocks';
import { highlight } from '../../core/highlight';
import { outline } from '../../core/outline';
import type { CodeToken } from '../../core/highlight';

export interface ArticleBodyProps {
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

function renderBlock(block: Block, key: string, headingId?: string): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 2 ? 'h2' : 'h3';
      const className = block.level === 2 ? styles.heading2 : styles.heading3;
      return (
        <Tag key={key} id={headingId} className={className}>
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
    case 'code': {
      const pre = (
        <pre key={key} className={styles.code}>
          {block.filename === null && block.language !== null && (
            <span className={styles.codeLang}>{block.language}</span>
          )}
          <code className={styles.codeText}>{renderCode(block.code, block.language, key)}</code>
        </pre>
      );
      if (block.filename === null) return pre;
      return (
        <figure key={key} className={styles.codeFile}>
          <figcaption className={styles.codeHeader}>
            <span className={styles.codeDot} aria-hidden="true" />
            <span className={styles.codeFilename}>{block.filename}</span>
            {block.language !== null && <span className={styles.codeHeaderLang}>{block.language}</span>}
          </figcaption>
          {pre}
        </figure>
      );
    }
    case 'highlight':
      return (
        <p key={key} className={styles.highlight}>
          {renderInline(block.children, key)}
        </p>
      );
    case 'note':
      return (
        <div key={key} className={styles.note} role="note">
          {block.title !== null && <p className={styles.noteTitle}>{renderInline(block.title, `${key}-t`)}</p>}
          <p className={styles.noteText}>{renderInline(block.children, key)}</p>
        </div>
      );
    case 'flow':
      return (
        <ol key={key} className={styles.flow}>
          {block.steps.map((step, index) => (
            <li key={`${key}-${String(index)}`} className={styles.flowStep}>
              <span className={styles.flowPill}>{renderInline(step, `${key}-${String(index)}`)}</span>
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div key={key} className={styles.tableScroll} tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.header.map((cell, column) => (
                  <th key={column} scope="col" data-align={block.align[column] ?? undefined}>
                    {renderInline(cell, `${key}-h${String(column)}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => (
                    <td key={column} data-align={block.align[column] ?? undefined}>
                      {renderInline(cell, `${key}-${String(rowIndex)}-${String(column)}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

export function ArticleBody({ markdown }: ArticleBodyProps) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
  const ids = useMemo(() => outline(blocks).map((entry) => entry.id), [blocks]);

  let heading = 0;
  return (
    <>
      {blocks.map((block, index) =>
        renderBlock(block, `block-${String(index)}`, block.type === 'heading' ? ids[heading++] : undefined),
      )}
    </>
  );
}

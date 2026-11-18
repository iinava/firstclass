import * as React from "react"

/**
 * A small, forgiving Markdown reader for text staff paste into the itinerary
 * (often straight out of ChatGPT): headings, bold/italic, bullet and numbered
 * lists, pipe tables and rules. Anything it doesn't recognise stays plain text,
 * and stray markers are dropped rather than shown, so a half-formatted paste
 * still reads cleanly. Renders plain semantic HTML. Each page styles it
 * through the `.rich-text` rules in globals.css.
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; head: string[] | null; rows: string[][] }
  | { type: "rule" }

const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,}|[—–]+)\s*$/
const HEADING = /^\s*(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*•+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())

export function parseRichText(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      flush()
      continue
    }

    if (RULE.test(line)) {
      flush()
      blocks.push({ type: "rule" })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      flush()
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] })
      continue
    }

    if (line.trim().startsWith("|")) {
      flush()
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) tableLines.push(lines[i++])
      i--
      const hasHead = tableLines.length > 1 && TABLE_SEPARATOR.test(tableLines[1])
      const body = tableLines.filter((row) => !TABLE_SEPARATOR.test(row)).map(cells)
      blocks.push({
        type: "table",
        head: hasHead ? body[0] : null,
        rows: hasHead ? body.slice(1) : body,
      })
      continue
    }

    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet || numbered) {
      flush()
      const ordered = Boolean(numbered)
      const pattern = ordered ? NUMBERED : BULLET
      const items: string[] = []
      while (i < lines.length && pattern.test(lines[i])) items.push(pattern.exec(lines[i++])![1])
      i--
      blocks.push({ type: "list", ordered, items })
      continue
    }

    paragraph.push(line.trim())
  }
  flush()
  return blocks
}

/** **bold** and *italic*; unmatched markers are removed instead of printed. */
export function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g
  let last = 0
  let match: RegExpExecArray | null
  const plain = (value: string) => value.replace(/\*\*|__/g, "")

  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(plain(text.slice(last, match.index)))
    const bold = match[1] ?? match[2]
    parts.push(
      bold !== undefined ? (
        <strong key={match.index}>{plain(bold)}</strong>
      ) : (
        <em key={match.index}>{plain(match[3])}</em>
      )
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(plain(text.slice(last)))
  return <>{parts}</>
}

export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseRichText(source)
  return (
    <div className={`rich-text ${className ?? ""}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level <= 1 ? (
              <h3 key={index} className="rt-h1">
                <Inline text={block.text} />
              </h3>
            ) : (
              <h4 key={index} className="rt-h2">
                <Inline text={block.text} />
              </h4>
            )
          case "paragraph":
            return (
              <p key={index}>
                {block.lines.map((line, n) => (
                  <React.Fragment key={n}>
                    {n > 0 && <br />}
                    <Inline text={line} />
                  </React.Fragment>
                ))}
              </p>
            )
          case "list": {
            const List = block.ordered ? "ol" : "ul"
            return (
              <List key={index}>
                {block.items.map((item, n) => (
                  <li key={n}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            )
          }
          case "table":
            return (
              <div key={index} className="rt-table">
                <table>
                  {block.head && (
                    <thead>
                      <tr>
                        {block.head.map((cell, n) => (
                          <th key={n}>
                            <Inline text={cell} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, n) => (
                          <td key={n}>
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case "rule":
            return <hr key={index} />
        }
      })}
    </div>
  )
}

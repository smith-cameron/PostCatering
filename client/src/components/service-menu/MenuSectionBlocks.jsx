import MenuTable from "./MenuTable";
import { normalizeMenuText } from "./serviceMenuUtils";

const BlockHeading = ({ title, nested = false }) => {
  if (!title) return null;

  return nested ? (
    <h5 className="h6 mb-2 menu-block-heading menu-block-heading-nested">{normalizeMenuText(title)}</h5>
  ) : (
    <h4 className="h6 mb-2 menu-section-title menu-block-heading">{normalizeMenuText(title)}</h4>
  );
};

const BlockPrice = ({ price, hasBodyContent }) => {
  if (!price) return null;

  return (
    <p className={hasBodyContent ? "mb-2 menu-block-price" : "mb-0 menu-block-price"}>
      <strong>{normalizeMenuText(price)}</strong>
    </p>
  );
};

const MenuSectionBlocks = ({ blocks = [], nested = false }) =>
  blocks.map((block, index) => {
    const isLastBlock = index === blocks.length - 1;
    const blockClassName = isLastBlock ? undefined : "mb-3";
    const blockKey = block.key || `${block.type}-${index}`;

    if (block.type === "text") {
      const hasText = Boolean(block.text);
      return (
        <div key={blockKey} className={blockClassName}>
          <BlockHeading title={block.title} nested={nested} />
          <BlockPrice price={block.price} hasBodyContent={hasText} />
          {hasText ? <p className="mb-0 menu-copy-block">{normalizeMenuText(block.text)}</p> : null}
        </div>
      );
    }

    if (block.type === "list") {
      return (
        <div key={blockKey} className={blockClassName ? `menu-list-block ${blockClassName}` : "menu-list-block"}>
          <BlockHeading title={block.title} nested={nested} />
          <BlockPrice price={block.price} hasBodyContent={Boolean(block.items?.length)} />
          {block.items?.length ? (
            <ul className="menu-list mb-0">
              {block.items.map((item, itemIndex) => (
                <li key={`${blockKey}-${itemIndex}`} className="menu-list-item">
                  {normalizeMenuText(item)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }

    if (block.type === "table") {
      return (
        <div key={blockKey} className={blockClassName}>
          <BlockHeading title={block.title} nested={nested} />
          <MenuTable columns={block.columns || []} rows={block.rows || []} />
        </div>
      );
    }

    if (block.type === "group") {
      const hasTitle = Boolean(block.title);
      const hasNote = Boolean(block.note);
      const hasChildBlocks = Boolean(block.blocks?.length);
      return (
        <div key={blockKey} className={blockClassName}>
          <BlockHeading title={block.title} nested={nested} />
          {hasNote ? (
            <p className={hasChildBlocks ? "mb-3 menu-group-note" : "mb-0 menu-group-note"}>
              {normalizeMenuText(block.note)}
            </p>
          ) : null}
          {hasChildBlocks ? <MenuSectionBlocks blocks={block.blocks} nested={hasTitle || nested} /> : null}
        </div>
      );
    }

    return null;
  });

export default MenuSectionBlocks;

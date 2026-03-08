import { Fragment } from "react";
import { Accordion } from "react-bootstrap";
import MenuSectionBlocks from "./MenuSectionBlocks";
import { buildMenuSections, normalizeMenuTitle } from "./serviceMenuUtils";

const flattenUntitledGroups = (blocks = []) =>
  blocks.flatMap((block) => {
    if (block?.type === "group" && !block.title && block.blocks?.length) {
      return flattenUntitledGroups(block.blocks);
    }
    return [block];
  });

const stripBlockTitle = (block) => ({
  ...block,
  title: undefined,
});

const toAccordionItems = (sections = []) =>
  sections.flatMap((section, sectionIndex) => {
    const normalizedBlocks = flattenUntitledGroups(section.blocks);
    const introBlocks = [];
    const candidateBlocks = [];

    normalizedBlocks.forEach((block) => {
      if (!candidateBlocks.length && block?.type === "text" && !block.title) {
        introBlocks.push(block);
        return;
      }

      candidateBlocks.push(block);
    });

    const shouldPromoteBlocks =
      candidateBlocks.length > 0 && candidateBlocks.every((block) => Boolean(block?.title));

    if (!shouldPromoteBlocks) {
      return [
        {
          id: section.id || `menu-section-${sectionIndex}`,
          title: section.title,
          sectionKind: section.sectionKind,
          contextTitle: "",
          contextBlocks: [],
          blocks: normalizedBlocks,
        },
      ];
    }

    return candidateBlocks.map((block, blockIndex) => ({
      id: `${section.id || `menu-section-${sectionIndex}`}-${block.key || blockIndex}`,
      title: block.title,
      sectionKind: section.sectionKind,
      contextTitle: section.title,
      contextBlocks: blockIndex === 0 ? introBlocks : [],
      blocks: [stripBlockTitle(block)],
    }));
  });

const CatalogSectionsAccordion = ({
  menuKey,
  data,
  menuOptions,
  approvedFormalPlans,
  formalMenuBlocks,
  sections,
}) => {
  const resolvedSections =
    sections ||
    buildMenuSections({
      menuKey,
      data,
      menuOptions,
      approvedFormalPlans,
      formalMenuBlocks,
    });
  const accordionItems = toAccordionItems(resolvedSections);

  return (
    <Accordion
      key={menuKey}
      className="menu-sections-accordion"
      alwaysOpen={false}
    >
      {accordionItems.map((item, index) => {
        const previousItem = accordionItems[index - 1];
        const showMenuBreak =
          item.sectionKind === "menu" &&
          previousItem?.sectionKind &&
          previousItem.sectionKind !== item.sectionKind;

        return (
          <Fragment key={item.id ?? index}>
            {showMenuBreak ? (
              <div className="menu-group-break" aria-hidden="true">
                <span className="menu-group-break-label">Menu Selections</span>
              </div>
            ) : null}
            <Accordion.Item eventKey={String(index)}>
              <Accordion.Header>{normalizeMenuTitle(item.title)}</Accordion.Header>
              <Accordion.Body>
                {item.contextTitle ? (
                  <p className="menu-item-context-label mb-3">{normalizeMenuTitle(item.contextTitle)}</p>
                ) : null}
                {item.contextBlocks.length ? <MenuSectionBlocks blocks={item.contextBlocks} /> : null}
                <div className={item.contextBlocks.length && item.blocks.length ? "mt-3" : undefined}>
                  <MenuSectionBlocks blocks={item.blocks} />
                </div>
              </Accordion.Body>
            </Accordion.Item>
          </Fragment>
        );
      })}
    </Accordion>
  );
};

export default CatalogSectionsAccordion;

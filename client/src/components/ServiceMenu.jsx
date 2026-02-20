import { useContext } from "react";
import { useParams } from "react-router-dom";
import { Button } from "react-bootstrap";
import useMenuConfig from "../hooks/useMenuConfig";
import Context from "../context";
import CatalogSectionsAccordion from "./service-menu/CatalogSectionsAccordion";
import FormalMenuAccordion from "./service-menu/FormalMenuAccordion";
import { normalizeMenuText, normalizeMenuTitle } from "./service-menu/serviceMenuUtils";
import useServiceMenuData from "./service-menu/useServiceMenuData";

const ServiceMenu = () => {
  const { menuKey } = useParams();
  const { openInquiryModal } = useContext(Context);
  const { menu, menuOptions, formalPlanOptions, loading, error } = useMenuConfig();
  const { data, approvedFormalPlans, formalMenuBlocks } = useServiceMenuData({
    menuKey,
    menu,
    formalPlanOptions,
  });

  if (loading) {
    return (
      <main className="container my-4">
        <p className="mb-0">Loading menu...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container my-4">
        <h2 className="mb-2">Menu unavailable</h2>
        <p className="mb-0">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container my-4">
        <h2 className="mb-2">Menu not found</h2>
        <p className="mb-0">Please choose a menu from Services.</p>
      </main>
    );
  }

  return (
    <main className="container my-4">
      <header className="mb-3">
        <h2 className="mb-1">{normalizeMenuTitle(data.pageTitle)}</h2>
        {data.subtitle ? <p className="mb-0">{normalizeMenuText(data.subtitle)}</p> : null}
      </header>

      {data.introBlocks?.map((block) => (
        <section key={block.title} className="mb-4">
          <h3 className="h5">{block.title}</h3>
          <ul className="mb-0">
            {block.bullets.map((bullet) => (
              <li key={bullet}>{normalizeMenuText(bullet)}</li>
            ))}
          </ul>
        </section>
      ))}

      {menuKey === "formal" ? (
        <FormalMenuAccordion menuKey={menuKey} approvedFormalPlans={approvedFormalPlans} formalMenuBlocks={formalMenuBlocks} />
      ) : (
        <CatalogSectionsAccordion menuKey={menuKey} data={data} menuOptions={menuOptions} />
      )}

      <div className="mt-3">
        <Button className="btn-inquiry-action" variant="secondary" onClick={() => openInquiryModal(menuKey)}>
          Request Inquiry About This Menu
        </Button>
      </div>
    </main>
  );
};

export default ServiceMenu;

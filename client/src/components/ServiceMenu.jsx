import { useParams } from "react-router-dom";
import { Accordion } from "react-bootstrap";
import { MENU, MENU_OPTIONS } from "../static/menuData";

const MenuTable = ({ columns, rows }) => (
  <div className="table-responsive">
    <table className="table align-middle mb-0">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx}>
            {r.map((cell, cidx) => (
              <td key={cidx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ServiceMenu = () => {
  const { menuKey } = useParams();
  const data = MENU[menuKey];

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
        <h2 className="mb-1">{data.pageTitle}</h2>
        {data.subtitle ? <p className="mb-0">{data.subtitle}</p> : null}
      </header>

      {data.introBlocks?.map((b) => (
        <section key={b.title} className="mb-4">
          <h3 className="h5">{b.title}</h3>
          <ul className="mb-0">
            {b.bullets.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      ))}

      <Accordion key={menuKey} defaultActiveKey={data.sections?.length ? "0" : undefined} alwaysOpen={false}>
        {data.sections.map((s, idx) => (
          <Accordion.Item eventKey={String(idx)} key={s.title ?? idx}>
            <Accordion.Header>{s.title}</Accordion.Header>
            <Accordion.Body>
              {s.type === "package" ? (
                <>
                  <p className="mb-2">{s.description}</p>
                  {s.price ? (
                    <p className="mb-0">
                      <strong>{s.price}</strong>
                    </p>
                  ) : null}
                </>
              ) : null}

              {s.type === "tiers" ? (
                <>
                  {s.tiers.map((t) => (
                    <div key={t.tierTitle} className="mb-3">
                      <h4 className="h6 mb-1">{t.tierTitle}</h4>
                      {t.price ? (
                        <p className="mb-2">
                          <strong>{t.price}</strong>
                        </p>
                      ) : null}
                      <ul className="mb-0">
                        {t.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : null}

              {s.type === "includeMenu" ? (
                <>
                  {s.note ? <p className="mb-3">{s.note}</p> : null}

                  {s.includeKeys.map((key) => {
                    const block = MENU_OPTIONS[key];
                    if (!block) return null;

                    return (
                      <div key={key} className="mb-3">
                        <h4 className="h6 mb-2">{block.title}</h4>
                        <ul className="mb-0">
                          {block.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {!s.type ? <MenuTable columns={s.columns} rows={s.rows} /> : null}
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>
    </main>
  );
};

export default ServiceMenu;

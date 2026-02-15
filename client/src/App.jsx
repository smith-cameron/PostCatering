import { BrowserRouter, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Context from "./context";
import { Wrapper, Landing, NotFound, ServiceMenu } from "./imports";
import "./App.css";

function App() {
  return (
    <div className="app">
      <Context.Provider value={"Houston, we have liftoff"}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Wrapper />}>
              <Route index element={<Landing />} />
              <Route path="services/:menuKey" element={<ServiceMenu />} />
              {/* <Route path="inquiry" element={<Inquiry />} /> */}
              {/* <Route path="contact" element={<ContactUs />} /> */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Context.Provider>
    </div>
  );
}

export default App;

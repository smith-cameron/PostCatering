import { Outlet } from "react-router-dom";
import { Header, Footer } from "../imports";

const Wrapper = () => {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
};

export default Wrapper;

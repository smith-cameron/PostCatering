import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <main className="container my-4">
      <h2 className="mb-2">Page Not Found</h2>
      <p>The page you requested does not exist... <strong><em>yet.</em></strong></p>

      <Link className="btn btn-primary" to="/">
        Return Home
      </Link>
    </main>
  );
};

export default NotFound;

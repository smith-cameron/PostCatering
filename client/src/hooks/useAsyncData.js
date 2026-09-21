import { useEffect, useState } from "react";

const useAsyncData = ({ initialData, loadData }) => {
  const [data, setData] = useState(() => initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const nextData = await loadData();
        if (!isMounted) return;
        setData(nextData);
        setError("");
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError?.message || "Unable to load data.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  return {
    data,
    error,
    loading,
    setData,
  };
};

export default useAsyncData;

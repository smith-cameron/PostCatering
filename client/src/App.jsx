import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import Context from './context';
import { Wrapper, Header, Body, Footer } from './imports';
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  // const [currentTime, setCurrentTime] = useState(0);
  // useEffect(() => {
  //   fetch('/api/time').then(res => res.json()).then(data => {
  //     console.log('Fetched data:', data);
  //     setCurrentTime(data.time);
  //   });
  // }, []);

  return (
    <div className="App">
      <Context.Provider value={"Houston, we have liftoff"}>
        <BrowserRouter>
          {/* Routes Go Here */}
          <Routes>
            <Route exact path="/" element={<Wrapper />} />
          </Routes>
        </BrowserRouter>
      </Context.Provider>





    </div>
  )
}

export default App
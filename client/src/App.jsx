//ADD React's `useEffect` function as an import
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  //ADD a new state inside the body of the `App()` function
  const [currentTime, setCurrentTime] = useState(0);
  //Make the API call that retrieves the time
  useEffect(() => {
    fetch('/api/time').then(res => res.json()).then(data => {
      console.log('Fetched data:', data);
      setCurrentTime(data.time);
    });
  }, []);

  return (
    <div className="App">
      <header className="container">
        <h1>Houston We Have Liftoff!!!!</h1>
      </header>
      <main className="container">
        <p>
          {currentTime
            ? `The current time is ${new Date(currentTime)}.`
            : "Loading current time..."}
        </p>
      </main>

      <div className="card">
        
      </div>
      <footer className="container">
        <p>© 2026</p>
      </footer>

    </div>
  )
}

export default App
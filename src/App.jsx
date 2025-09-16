import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";

import Home from "./pages/Home";
import Producer from "./pages/Producer";
import Consumer from "./pages/Consumer";
import Login from "./pages/Login";
import ProducerAuth from "./pages/ProducerAuth";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

function App() {
  const [user, setUser] = useState(null);  // store logged in user
  const [items, setItems] = useState([]);  // store produce items

  const addItem = (newItem) => setItems([...items, newItem]);
  const removeItem = (index) =>
    setItems(items.filter((_, i) => i !== index));

  return (
    <Router>
      <div className="page-wrapper">
        <Navbar user={user} />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />

            {/* Authentication */}
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/producer-login" element={<ProducerAuth setUser={setUser} />} />

            {/* Dashboards */}
            <Route
              path="/producer"
              element={<Producer onAdd={addItem} items={items} onRemove={removeItem} />}
            />
            <Route path="/consumer" element={<Consumer items={items} />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;

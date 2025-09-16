import { Link } from "react-router-dom";
import React, { useState } from "react";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Optional: Close the menu after clicking a link (improves mobile experience)
  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <h1 className="logo">🌱 Trichy Fresh Connect</h1>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="navbar-toggle"
        aria-label="Toggle navigation"
      >
        ☰
      </button>
      <div className={`navbar-links${menuOpen ? " open" : ""}`}>
        <Link to="/" onClick={closeMenu}>Home</Link>
        <Link to="/register" onClick={closeMenu}>Register</Link>
        <Link to="/login" onClick={closeMenu}>Login</Link>
        <Link to="/contact" onClick={closeMenu}>Contact</Link>
      </div>
      <style>{`
        .navbar {
          background-color: #15803d;
          color: white;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          position: relative;
        }

        .logo {
          font-size: 20px;
          font-weight: bold;
        }

        .navbar-links {
          display: flex;
          flex-direction: row;
          align-items: center;
        }

        .navbar-links a {
          color: white;
          text-decoration: none;
          margin-left: 15px;
          font-weight: 500;
          position: relative;
        }

        .navbar-toggle {
          display: none;
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          margin-left: auto;
        }

        @media (max-width: 768px) {
          .navbar-toggle {
            display: block;
          }
          .navbar-links {
            flex-direction: column;
            width: 100%;
            background: #15803d;
            position: absolute;
            top: 60px;
            left: 0;
            z-index: 100;
            display: none;
          }
          .navbar-links.open {
            display: flex;
          }
          .navbar-links a {
            margin: 10px 0;
            padding: 10px 20px;
            display: block;
          }
        }
      `}</style>
    </nav>
  );
}

export default Navbar;

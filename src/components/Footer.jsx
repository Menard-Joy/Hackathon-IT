function Footer() {
  return (
    <footer className="footer">
      <p>
        © {new Date().getFullYear()} Trichy Fresh Connect | Built at Hackathon 🚀
      </p>

      <style>{`
        .footer {
          background-color: #15803d;
          color: white;
          text-align: center;
          padding: 12px;
          margin-top: auto; /* pushes it to bottom */
          width: 100%;
        }
        @media (max-width: 768px) {
          .footer {
            font-size: 16px;
            padding: 16px;
          }
        }
      `}</style>
    </footer>
  );
}

export default Footer;

import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ setUser }) {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    profile: "",
    address: "",
    taluk: "",
    password: ""
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSignup) {
      alert("Consumer registered successfully!");
    } else {
      alert("Consumer logged in!");
    }
    setUser({ role: "consumer", ...form });
    navigate("/consumer");
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>
        {isSignup ? "Register" : "Login"}
      </h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        {isSignup && (
          <>
            <input name="name" placeholder="Name" onChange={handleChange} style={styles.input} />
            <input name="phone" placeholder="Phone Number" onChange={handleChange} style={styles.input} />
            <input name="profile" placeholder="Profile" onChange={handleChange} style={styles.input} />
            <input name="address" placeholder="Location / Address" onChange={handleChange} style={styles.input} />
            <input name="taluk" placeholder="Taluk" onChange={handleChange} style={styles.input} />
          </>
        )}
        <input name="email" type="email" placeholder="Email" onChange={handleChange} style={styles.input} />
        <input name="password" type="password" placeholder="Password" onChange={handleChange} style={styles.input} />
        <button type="submit" style={styles.button}>
          {isSignup ? "Sign Up" : "Login"}
        </button>
      </form>
      <p>
        {isSignup ? "Already have an account?" : "Don’t have an account?"}{" "}
        <span style={{ color: "blue", cursor: "pointer" }} onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? "Login" : "Sign Up"}
        </span>
      </p>
    </div>
  );
}

const styles = {
  container: { textAlign: "center", padding: "40px" },
  title: { fontSize: "26px", fontWeight: "bold", marginBottom: "20px" },
  form: { maxWidth: "300px", margin: "0 auto", display: "flex", flexDirection: "column" },
  input: { padding: "10px", margin: "8px 0", borderRadius: "5px", border: "1px solid #ccc" },
  button: { padding: "10px", backgroundColor: "#15803d", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }
};

export default Login;
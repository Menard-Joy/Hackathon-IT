function Home() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🌱 Welcome to Trichy Fresh Connect</h1>
      <p style={styles.subtitle}>
        A platform connecting local farmers & gardeners with nearby consumers 
        for fresh and sustainable produce.
      </p>

      <div style={styles.features}>
        <div style={styles.card}>
          <h3>👨‍🌾 For Producers</h3>
          <p>Post your fresh produce easily with details like quantity, location, and contact info.</p>
        </div>
        <div style={styles.card}>
          <h3>🛒 For Consumers</h3>
          <p>Browse fresh produce, filter by location, and contact producers directly.</p>
        </div>
        <div style={styles.card}>
          <h3>🌍 Why?</h3>
          <p>Support local farmers, reduce waste, and enjoy farm-fresh healthy food.</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    textAlign: "center",
    padding: "40px",
  },
  title: {
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "10px",
    color: "#166534",
  },
  subtitle: {
    fontSize: "18px",
    marginBottom: "30px",
    color: "#374151",
  },
  features: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
    marginTop: "20px",
  },
  card: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
};

export default Home;


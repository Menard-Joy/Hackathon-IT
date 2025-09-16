import { useState } from "react";

function ProducerForm({ onAdd }) {
  const [produce, setProduce] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!produce || !quantity || !location || !contact) return;
    onAdd({ produce, quantity, location, contact });
    setProduce(""); setQuantity(""); setLocation(""); setContact("");
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-green-50">
      <h2 className="text-xl font-bold mb-2">Post Produce</h2>
      <input className="border p-2 m-1" placeholder="Produce name" value={produce} onChange={(e) => setProduce(e.target.value)} />
      <input className="border p-2 m-1" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      <input className="border p-2 m-1" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
      <input className="border p-2 m-1" placeholder="Contact Info" value={contact} onChange={(e) => setContact(e.target.value)} />
      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Add</button>
    </form>
  );
}

export default ProducerForm;

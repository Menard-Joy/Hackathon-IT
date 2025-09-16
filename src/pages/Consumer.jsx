import ProduceCard from "../components/ProduceCard";

function Consumer({ items }) {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Available Produce</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {items.length > 0 ? (
          items.map((item, idx) => <ProduceCard key={idx} data={item} />)
        ) : (
          <p>No produce available yet.</p>
        )}
      </div>
    </div>
  );
}

export default Consumer;

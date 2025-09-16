import ProduceCard from "./ProduceCard";

function ProduceList({ items, onRemove }) {
  if (items.length === 0) {
    return <p className="p-4">No produce listed yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      {items.map((item, idx) => (
        <ProduceCard key={idx} data={item} index={idx} onRemove={onRemove} />
      ))}
    </div>
  );
}

export default ProduceList;

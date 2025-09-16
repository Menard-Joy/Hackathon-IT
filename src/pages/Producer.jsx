import ProducerForm from "../components/ProducerForm";
import ProduceList from "../components/ProduceList";

function Producer({ onAdd, items, onRemove }) {
  return (
    <div className="p-4">
      <ProducerForm onAdd={onAdd} />
      <h2 className="text-2xl font-bold mt-6">Your Listings</h2>
      <ProduceList items={items} onRemove={onRemove} />
    </div>
  );
}

export default Producer;

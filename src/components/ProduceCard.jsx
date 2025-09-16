function ProduceCard({ data, onRemove, index }) {
  return (
    <div className="border p-4 rounded shadow bg-white">
      <h2 className="text-lg font-bold">{data.produce}</h2>
      <p>Quantity: {data.quantity}</p>
      <p>Location: {data.location}</p>
      <p>
        Contact: <a href={`tel:${data.contact}`} className="text-green-600">{data.contact}</a>
      </p>
      {onRemove && (
        <button onClick={() => onRemove(index)} className="bg-red-600 text-white px-3 py-1 mt-2 rounded">
          Remove
        </button>
      )}
    </div>
  );
}

export default ProduceCard;

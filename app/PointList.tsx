import type { Airfoil } from "./page";

export default function AirfoilPointList({
  airfoil,
}: {
  airfoil: Airfoil | null;
}) {
  return (
    <div className="border border-gray-400 rounded p-1 flex-1">
      <div>
        {airfoil != null ? (
          <div>{airfoil.name}</div>
        ) : (
          <div>no airfoil in memory</div>
        )}

        {airfoil != null ? (
          airfoil.points.map((p, idx) => (
            <div key={idx}>
              {p.x} {p.y}
            </div>
          ))
        ) : (
          <div>no points to show</div>
        )}
      </div>
    </div>
  );
}

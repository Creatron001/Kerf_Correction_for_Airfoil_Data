"use client";

import { useState } from "react";
import AirfoilPointList from "./PointList";
import { cursorTo } from "readline";

type Point = {
  x: number;
  y: number;
};

export type Airfoil = {
  name: string;
  points: Point[];
};

export default function Home() {
  const [airfoil, setAirfoil] = useState<Airfoil | null>(null);

  const [scaleFactor, setScaleFactor] = useState<number>(200); //The final depth the airfoil should have
  const [kerf, setKerf] = useState<number>(3); //Kerf is the diameter of the tool
  const [airfoilModded, setAirfoilModded] = useState<Airfoil | null>(null);

  function normalizePointVector(p: Point): Point {
    const len = Math.hypot(p.x, p.y); //same as Math.sqrt(x*x + y*y)
    return { x: p.x / len, y: p.y / len };
  }
  function calcNormalVector(p: Point, direction: boolean): Point {
    //direction: 0 clockwise, 1 counter-clockwise
    if (direction === false) {
      return { x: p.y, y: -p.x };
    }
    return { x: -p.y, y: p.x };
  }
  function calcPointToPointVector(p1: Point, p2: Point): Point {
    return { x: p2.x - p1.x, y: p2.y - p1.y };
  }
  function addPointVectors(p1: Point, p2: Point): Point {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
  }

  function handleKerfCorrection() {
    if (!airfoil || airfoil.points.length < 2) return; //requires a valid airfoil to edit //TODO: error

    const shrinkFactorX = (scaleFactor - kerf) / scaleFactor; // takes away the radius of the tool in the back and in the front, (2*tool_Radius = Kerf)
    const shrinkFactorY = (scaleFactor - kerf / 2) / scaleFactor; // takes away the radius of the tool
    const shrunkenKerfRadius = kerf / (scaleFactor * 2);

    const shrunkenPoints: Point[] = airfoil.points.map((OP) => {
      return {
        x: Number((OP.x * shrinkFactorX + shrunkenKerfRadius).toFixed(4)), //takes away the kerf Radius in the front and back and centers all the points, so the tool has room
        y: Number((OP.y * shrinkFactorY).toFixed(4)),
      };
    });

    //-------------------------------------First three points-------------------------------------------------------------------------------
    //PN : Point New
    //PO : Point Old

    const PN1: Point = { x: 1, y: 0 }; //Start in the back

    //Calculate third point
    const PO1 = shrunkenPoints[0]; //first and second points of shrunken airfoil
    const PO2 = shrunkenPoints[1];

    const PO1_PO2: Point = calcPointToPointVector(PO1, PO2);
    const PO1_PO2_Normal: Point = normalizePointVector(
      calcNormalVector(PO1_PO2, false),
    ); //Normal Vector from first to second point, normalized to length 1
    const PN3: Point = {
      x: PO1.x + PO1_PO2_Normal.x * shrunkenKerfRadius,
      y: PO1.y + PO1_PO2_Normal.y * shrunkenKerfRadius,
    };

    const PN2: Point = { x: PN1.x - 0.00001, y: PN3.y }; //offset second point, so no points are exactly above another, which would throw off the gcode generator.

    //-------------------------------------------modifie upper points-------------------------------------------------------------------------

    const indexNosePoint = shrunkenPoints.reduce(
      (bestIndex, point, index, points) => {
        return point.x < points[bestIndex].x ? index : bestIndex;
      },
      0,
    );

    const oldUpperSide = shrunkenPoints.slice(0, indexNosePoint + 1);
    const moddedUpperSide: Point[] = [];

    const modified_points = [PN1, PN2, PN3];

    for (let i = 1; i < oldUpperSide.length - 1; i++) {
      const previousPoint = oldUpperSide[i - 1];
      const currentPoint = oldUpperSide[i];
      const nextPoint = oldUpperSide[i + 1];

      const vec1 = calcNormalVector(
        calcPointToPointVector(currentPoint, previousPoint),
        true,
      );
      const vec2 = calcNormalVector(
        calcPointToPointVector(currentPoint, nextPoint),
        false,
      );
      const vec3 = normalizePointVector(addPointVectors(vec1, vec2));
      let newPoint = {
        x: currentPoint.x + vec3.x * shrunkenKerfRadius,
        y: currentPoint.y + vec3.y * shrunkenKerfRadius,
      };

      moddedUpperSide.push(newPoint);
      modified_points.push(newPoint);
    }

    modified_points.push({ x: 0, y: 0 }); //add nose point back

    const oldLowerSide = shrunkenPoints.slice(indexNosePoint);
    const moddedLowerSide: Point[] = [];

    for (let i = 1; i < oldLowerSide.length - 1; i++) {
      //different input Points
      //todo: create a unified function
      const previousPoint = oldLowerSide[i - 1];
      const currentPoint = oldLowerSide[i];
      const nextPoint = oldLowerSide[i + 1];

      const vec1 = calcNormalVector(
        calcPointToPointVector(currentPoint, previousPoint),
        true, //difference is here
      );
      const vec2 = calcNormalVector(
        calcPointToPointVector(currentPoint, nextPoint),
        false, //difference is here
      );
      const vec3 = normalizePointVector(addPointVectors(vec1, vec2));
      const newPoint = {
        x: currentPoint.x + vec3.x * shrunkenKerfRadius,
        y: currentPoint.y + vec3.y * shrunkenKerfRadius,
      };
      moddedLowerSide.push(newPoint);
      modified_points.push(newPoint);
    }
    //TODO: create last three points

    //Calculate third point
    const pointsLenght = shrunkenPoints.length;
    const PO_1 = shrunkenPoints[pointsLenght - 1]; //last and second to last points
    const PO_2 = shrunkenPoints[pointsLenght - 2];

    const PO_1_PO_2: Point = calcPointToPointVector(PO_2, PO_1);
    const PO_1_PO_2_Normal: Point = normalizePointVector(
      calcNormalVector(PO_1_PO_2, false),
    ); //Normal Vector from first to second point, normalized to length 1
    const PN_3: Point = {
      x: PO_1.x + PO_1_PO_2_Normal.x * shrunkenKerfRadius,
      y: PO_1.y + PO_1_PO_2_Normal.y * shrunkenKerfRadius,
    };

    const PN_2: Point = { x: PN1.x - 0.00001, y: PN_3.y };

    modified_points.push(PN_3);
    modified_points.push(PN_2);
    modified_points.push(PN1); //Back to the beginning

    const trimmed_points: Point[] = modified_points.map((p) => {
      return { x: Number(p.x.toFixed(5)), y: Number(p.y.toFixed(5)) };
    });

    //-------------------------------------------create modified airfoil-------------------------------------------------------------------------

    const modded_name = airfoil.name + "_modded";

    setAirfoilModded({ name: modded_name, points: trimmed_points });
  }

  async function handleSave() {
    if (!airfoilModded) return;

    const fileContent =
      airfoilModded.name +
      "\n" +
      airfoilModded.points
        .map((p) => `${p.x.toFixed(5)} ${p.y.toFixed(5)}`)
        .join("\n");

    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${airfoilModded.name}.dat`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async function handleLoadAndParseAirfoil(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const text = await file.text();

    const parsed_lines = text.split("\n");
    const airfoil_name = parsed_lines[0].trim();
    const rest_lines = parsed_lines.slice(1);

    const parsed_points = rest_lines.map((line, index) => {
      const [x, y] = line
        .trim() //remove empty spaces in front of line
        .split(/\s+/)
        .map(Number);
      return { x, y };
    });

    const parsed_airfoil: Airfoil = {
      name: airfoil_name,
      points: parsed_points,
    };

    setAirfoil(parsed_airfoil);
  }

  return (
    <main>
      <div className="border border-gray-400 rounded p-1 bg-teal-900">
        <div>
          <label>Kerf Value: </label>
          <input
            type="number"
            min="1"
            value={kerf}
            onChange={(event) => setKerf(Number(event.target.value))}
          />
        </div>
        <div>
          <label>Scale Factor: </label>
          <input
            type="number"
            min="1"
            value={scaleFactor}
            onChange={(event) => setScaleFactor(Number(event.target.value))}
          />
        </div>
        <label className="text-red-500">
          Modified Scale Factor: {kerf + scaleFactor}
        </label>
      </div>

      <div className="border border-gray-400 rounded p-1">
        <div>
          <input
            type="file"
            onChange={handleLoadAndParseAirfoil}
            className="border border-gray-400 rounded p-0.5"
          />
        </div>
        <div>
          <input
            type="button"
            value="Modify points"
            onClick={handleKerfCorrection}
            className="border border-gray-400 rounded p-0.5"
          />
        </div>
        <div>
          <input
            type="button"
            value="save modified airfoil"
            onClick={handleSave}
            className="border border-gray-400 rounded p-0.5"
          />
        </div>{" "}
      </div>
      <div className="flex gap-0">
        <AirfoilPointList airfoil={airfoil} />
        <AirfoilPointList airfoil={airfoilModded} />
      </div>
    </main>
  );
}

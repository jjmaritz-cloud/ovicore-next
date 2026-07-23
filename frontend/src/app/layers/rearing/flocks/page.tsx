"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

type RearingFlockRow = {
  id: number;
  farm: string;
  shed: string;
  flockCode: string;
  breed: string;
  placementDate: string;
  birdsPlaced: number;
  plannedTransferDate: string;
  destination: string;
  status: string;
};

const initialRows: RearingFlockRow[] = [];

export default function LayerRearingFlocksPage() {
  const [rows] = useState<RearingFlockRow[]>(initialRows);
  const [searchText, setSearchText] = useState("");

  const visibleRows = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) return rows;

    return rows.filter((row) =>
      [
        row.farm,
        row.shed,
        row.flockCode,
        row.breed,
        row.destination,
        row.status,
      ].some((value) => value.toLowerCase().includes(search)),
    );
  }, [rows, searchText]);

  const kpis = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) =>
        ["planned", "placed", "growing"].includes(row.status.toLowerCase()),
      ).length,
      birds: rows.reduce((sum, row) => sum + row.birdsPlaced, 0),
      transfers: rows.filter((row) =>
        row.status.toLowerCase().includes("transfer"),
      ).length,
    };
  }, [rows]);

  return (
    <div className="page-shell">
      <OviCoreSidebar menu={getSidebarMenu("layers")} />

      <main className="main-panel">
        <OviCoreModuleHeader
          eyebrow="OviCore Layer Rearing"
          title="Rearing Flock Register"
          description="Create and manage commercial pullet flocks, placement details and planned transfers."
          actions={[
            {
              label: "Rearing Overview",
              href: "/layers/rearing",
              type: "home",
            },
          ]}
        />

        <section className="flock-toolbar">
          <div>
            <p className="eyebrow">Commercial Pullet Flocks</p>
            <h2>Rearing flock register</h2>
            <p>
              The backend connection and add-flock form are the next development
              step. This page establishes the final register structure first.
            </p>
          </div>

          <div className="toolbar-actions">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search farm, shed, flock or breed"
            />
            <button type="button" disabled>
              Add rearing flock
            </button>
          </div>
        </section>

        <section className="flock-kpis">
          <div>
            <span>Total Flocks</span>
            <strong>{kpis.total}</strong>
            <p>All commercial rearing flocks.</p>
          </div>
          <div>
            <span>Planned / Active</span>
            <strong>{kpis.active}</strong>
            <p>Flocks planned, placed or growing.</p>
          </div>
          <div>
            <span>Birds Placed</span>
            <strong>{kpis.birds.toLocaleString()}</strong>
            <p>Total initial placements.</p>
          </div>
          <div>
            <span>Transfers Due</span>
            <strong>{kpis.transfers}</strong>
            <p>Flocks approaching transfer.</p>
          </div>
        </section>

        <section className="register-card">
          <div className="register-head">
            <div>
              <h3>Layer Rearing Flocks</h3>
              <p>
                Farm, shed, breed, placement and destination transfer details.
              </p>
            </div>

            <Link href="/layers/rearing">Back to overview</Link>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Farm</th>
                  <th>Shed</th>
                  <th>Flock Code</th>
                  <th>Breed</th>
                  <th>Placement Date</th>
                  <th>Birds Placed</th>
                  <th>Planned Transfer</th>
                  <th>Destination</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <strong>No rearing flocks loaded yet</strong>
                        <span>
                          Next we will add the database model, API endpoints and
                          create-flock form.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.farm}</td>
                      <td>{row.shed}</td>
                      <td>{row.flockCode}</td>
                      <td>{row.breed}</td>
                      <td>{row.placementDate}</td>
                      <td>{row.birdsPlaced.toLocaleString()}</td>
                      <td>{row.plannedTransferDate}</td>
                      <td>{row.destination}</td>
                      <td>
                        <span className="status-pill">{row.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <style jsx>{`
          .flock-toolbar {
            margin: 14px 0;
            padding: 18px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            border: 1px solid #d8e8df;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 10px 24px rgba(19, 70, 51, 0.07);
          }

          .eyebrow {
            margin: 0 0 5px;
            color: #19744e;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .flock-toolbar h2 {
            margin: 0;
            color: #123e2f;
            font-size: 24px;
            letter-spacing: -0.035em;
          }

          .flock-toolbar p:last-child {
            margin: 6px 0 0;
            color: #687e74;
            font-size: 11px;
          }

          .toolbar-actions {
            display: flex;
            gap: 8px;
          }

          .toolbar-actions input {
            width: min(330px, 32vw);
            height: 40px;
            padding: 0 12px;
            border: 1px solid #ceded5;
            border-radius: 9px;
            background: #fbfdfc;
          }

          .toolbar-actions button {
            height: 40px;
            padding: 0 14px;
            border: 0;
            border-radius: 9px;
            background: #0d704b;
            color: #fff;
            font-size: 11px;
            font-weight: 900;
            opacity: 0.55;
          }

          .flock-kpis {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .flock-kpis > div {
            padding: 15px;
            border: 1px solid #dce9e2;
            border-radius: 13px;
            background: #fff;
          }

          .flock-kpis span {
            color: #60756c;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .flock-kpis strong {
            display: block;
            margin-top: 5px;
            color: #0c573d;
            font-size: 24px;
          }

          .flock-kpis p {
            margin: 4px 0 0;
            color: #71847c;
            font-size: 10px;
          }

          .register-card {
            overflow: hidden;
            border: 1px solid #d9e8e0;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 10px 24px rgba(19, 70, 51, 0.07);
          }

          .register-head {
            padding: 16px 18px;
            display: flex;
            justify-content: space-between;
            gap: 20px;
            border-bottom: 1px solid #e5eee9;
          }

          .register-head h3 {
            margin: 0;
            color: #123e2f;
            font-size: 18px;
          }

          .register-head p {
            margin: 4px 0 0;
            color: #6a8076;
            font-size: 10px;
          }

          .register-head a {
            color: #0d704b;
            font-size: 11px;
            font-weight: 900;
          }

          .table-scroll {
            overflow-x: auto;
          }

          table {
            width: 100%;
            min-width: 1040px;
            border-collapse: collapse;
          }

          th {
            padding: 11px 12px;
            background: #0b4b38;
            color: #fff;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.06em;
            text-align: left;
            text-transform: uppercase;
          }

          td {
            padding: 12px;
            border-bottom: 1px solid #e8efeb;
            color: #315447;
            font-size: 11px;
          }

          .empty-state {
            min-height: 210px;
            display: grid;
            place-content: center;
            gap: 6px;
            text-align: center;
          }

          .empty-state strong {
            color: #174734;
            font-size: 16px;
          }

          .empty-state span {
            color: #71847c;
            font-size: 11px;
          }

          .status-pill {
            padding: 5px 8px;
            border-radius: 999px;
            background: #eaf7ef;
            color: #24734f;
            font-size: 9px;
            font-weight: 900;
          }

          @media (max-width: 950px) {
            .flock-toolbar {
              align-items: flex-start;
              flex-direction: column;
            }

            .toolbar-actions {
              width: 100%;
            }

            .toolbar-actions input {
              width: 100%;
            }

            .flock-kpis {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 620px) {
            .flock-kpis {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </main>
    </div>
  );
}

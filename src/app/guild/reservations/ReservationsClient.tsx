"use client";

import { useState } from "react";

type Member = {
  id: string;
  characterName: string | null;
  priority: string;
  eligible: boolean;
};

type Resource = {
  id: string;
  name: string;
  type: "FEATHER" | "CARD";
  total: number;
  perPlayerLimit: number;
};

type Reservation = {
  id: string;
  memberId: string;
  resourceId: string;
  quantity: number;
  memberName: string | null;
  resourceName: string;
  resourceType: "FEATHER" | "CARD";
  resourceTotal: number;
};

type FormState = {
  memberId: string;
  resourceId: string;
  quantity: string;
};

const TYPE_LABELS = {
  FEATHER: "Feather",
  CARD: "Card",
};

export default function ReservationsClient({
  initialMembers,
  initialResources,
  initialReservations,
}: {
  initialMembers: Member[];
  initialResources: Resource[];
  initialReservations: Reservation[];
}) {
  const [members, setMembers] =
    useState<Member[]>(initialMembers);

  const [resources, setResources] =
    useState<Resource[]>(initialResources);

  const [reservations, setReservations] =
    useState<Reservation[]>(initialReservations);

  const [showForm, setShowForm] =
    useState(false);

  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  function openCreate() {
    setEditingReservation(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(reservation: Reservation) {
    setEditingReservation(reservation);
    setShowForm(true);
    setError("");
  }

  async function saveReservation(data: {
    memberId: string;
    resourceId: string;
    quantity: number;
  }) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/guild/reservations",
        {
          method: editingReservation
            ? "PUT"
            : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: editingReservation?.id,
            ...data,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to save reservation."
        );
      }

      const reservation =
        result.reservation;

      if (editingReservation) {
        setReservations((current) =>
          current
            .map((item) =>
              item.id === reservation.id
                ? reservation
                : item
            )
            .sort((a, b) =>
              a.memberName.localeCompare(
                b.memberName
              )
            )
        );
      } else {
        setReservations((current) =>
          [
            ...current,
            reservation,
          ].sort((a, b) =>
            a.memberName.localeCompare(
              b.memberName
            )
          )
        );
      }

      setShowForm(false);
      setEditingReservation(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save reservation."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteReservation(
    reservation: Reservation
  ) {
    const confirmed =
      window.confirm(
        `Remove ${reservation.resourceName} reservation for ${reservation.memberName}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/guild/reservations?id=${encodeURIComponent(
          reservation.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to delete reservation."
        );
      }

      setReservations((current) =>
        current.filter(
          (item) =>
            item.id !== reservation.id
        )
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete reservation."
      );
    }
  }

  return (
    <>
      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Reservations"
          value={reservations.length}
        />

        <SummaryCard
          label="Reserved Quantity"
          value={reservations.reduce(
            (sum, item) =>
              sum + item.quantity,
            0
          )}
        />

        <SummaryCard
          label="Members With Reservations"
          value={
            new Set(
              reservations.map(
                (item) => item.memberId
              )
            ).size
          }
        />
      </div>

      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Reservations are removed from the available allocation pool.
        </p>

        <button
          type="button"
          onClick={openCreate}
          disabled={
            members.length === 0 ||
            resources.length === 0
          }
          className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add Reservation
        </button>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* =====================================================
          FORM
      ===================================================== */}

      {showForm && (
        <ReservationForm
          members={members}
          resources={resources}
          reservation={editingReservation}
          saving={saving}
          onCancel={() => {
            setShowForm(false);
            setEditingReservation(null);
          }}
          onSave={saveReservation}
        />
      )}

      {/* =====================================================
          EMPTY STATE
      ===================================================== */}

      {reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
          <h2 className="text-xl font-semibold">
            No reservations yet
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Reserved resources will be assigned directly to the selected member.
          </p>

          <button
            type="button"
            onClick={openCreate}
            disabled={
              members.length === 0 ||
              resources.length === 0
            }
            className="mt-6 rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add Reservation
          </button>
        </div>
      ) : (
        /* =====================================================
           TABLE
        ===================================================== */

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Member
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Resource
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Type
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Quantity
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Resource Total
                  </th>

                  <th className="px-6 py-4 text-right font-medium text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800">
                {reservations.map(
                  (reservation) => (
                    <tr
                      key={reservation.id}
                      className="transition hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4 font-medium">
                        {reservation.memberName}
                      </td>

                      <td className="px-6 py-4">
                        {reservation.resourceName}
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs">
                          {
                            TYPE_LABELS[
                              reservation.resourceType
                            ]
                          }
                        </span>
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        {reservation.quantity}
                      </td>

                      <td className="px-6 py-4 text-zinc-400">
                        {reservation.resourceTotal}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                reservation
                              )
                            }
                            className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium hover:border-zinc-500 hover:bg-zinc-800"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteReservation(
                                reservation
                              )
                            }
                            className="rounded-md border border-red-900 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================
// SUMMARY CARD
// =============================================================

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}

// =============================================================
// RESERVATION FORM
// =============================================================

function ReservationForm({
  members,
  resources,
  reservation,
  saving,
  onCancel,
  onSave,
}: {
  members: Member[];
  resources: Resource[];
  reservation: Reservation | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (data: {
    memberId: string;
    resourceId: string;
    quantity: number;
  }) => void;
}) {
  const [form, setForm] = useState<FormState>({
    memberId:
      reservation?.memberId ??
      members[0]?.id ??
      "",
    resourceId:
      reservation?.resourceId ??
      resources[0]?.id ??
      "",
    quantity:
      reservation?.quantity.toString() ??
      "1",
  });

  const selectedResource =
    resources.find(
      (resource) =>
        resource.id === form.resourceId
    );

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const quantity = Number(
      form.quantity
    );

    onSave({
      memberId: form.memberId,
      resourceId: form.resourceId,
      quantity,
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">
          {reservation
            ? "Edit Reservation"
            : "Add Reservation"}
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Reserve a quantity of a resource for a specific member.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* MEMBER */}

        <div>
          <label
            htmlFor="reservation-member"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Member
          </label>

          <select
            id="reservation-member"
            value={form.memberId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                memberId:
                  event.target.value,
              }))
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
          >
            {members.map((member) => (
              <option
                key={member.id}
                value={member.id}
              >
                {member.characterName}
                {!member.eligible
                  ? " (Not Eligible)"
                  : ""}
              </option>
            ))}
          </select>
        </div>

        {/* RESOURCE */}

        <div>
          <label
            htmlFor="reservation-resource"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Resource
          </label>

          <select
            id="reservation-resource"
            value={form.resourceId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                resourceId:
                  event.target.value,
              }))
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
          >
            {resources.map((resource) => (
              <option
                key={resource.id}
                value={resource.id}
              >
                {resource.name} —{" "}
                {
                  TYPE_LABELS[
                    resource.type
                  ]
                }
              </option>
            ))}
          </select>
        </div>

        {/* QUANTITY */}

        <div>
          <label
            htmlFor="reservation-quantity"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Quantity
          </label>

          <input
            id="reservation-quantity"
            type="number"
            min="1"
            max={selectedResource?.total}
            value={form.quantity}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                quantity:
                  event.target.value,
              }))
            }
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
          />

          {selectedResource && (
            <p className="mt-2 text-xs text-zinc-500">
              Resource total: {selectedResource.total} ·
              Per-player limit for normal allocation:{" "}
              {selectedResource.perPlayerLimit}
            </p>
          )}
        </div>

        {/* INFO */}

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          Reservations are assigned directly to the selected member and
          removed from the normal allocation pool. Reservations can exceed
          the normal per-player allocation limit.
        </div>

        {/* BUTTONS */}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-zinc-700 px-5 py-3 font-medium hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !form.memberId ||
              !form.resourceId ||
              !form.quantity
            }
            className="rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : reservation
                ? "Save Changes"
                : "Add Reservation"}
          </button>
        </div>
      </form>
    </section>
  );
}
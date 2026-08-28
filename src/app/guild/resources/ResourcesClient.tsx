"use client";

import { useState } from "react";

type ResourceType = "FEATHER" | "CARD";

type Resource = {
  id: string;
  name: string;
  type: ResourceType;
  total: number;
  perPlayerLimit: number;
  hardCap: number;
  active: boolean;
};

const RESOURCE_TYPES: ResourceType[] = [
  "FEATHER",
  "CARD",
];

const RESOURCE_TYPE_LABELS: Record<
  ResourceType,
  string
> = {
  FEATHER: "Feather",
  CARD: "Card",
};

export default function ResourcesClient({
  initialResources,
}: {
  initialResources: Resource[];
}) {
  const [resources, setResources] =
    useState<Resource[]>(initialResources);

  const [showForm, setShowForm] =
    useState(false);

  const [editingResource, setEditingResource] =
    useState<Resource | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  function openCreate() {
    setEditingResource(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(resource: Resource) {
    setEditingResource(resource);
    setShowForm(true);
    setError("");
  }

  async function saveResource(data: {
    name: string;
    type: ResourceType;
    total: number;
    perPlayerLimit: number;
    hardCap: number;
    active: boolean;
  }) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/guild/resources",
        {
          method: editingResource
            ? "PUT"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: editingResource?.id,
            ...data,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to save resource."
        );
      }

      const resource =
        result.resource as Resource;

      if (editingResource) {
        setResources((current) =>
          current.map((item) =>
            item.id === resource.id
              ? resource
              : item
          )
        );
      } else {
        setResources((current) =>
          [...current, resource].sort(
            (a, b) => {
              if (a.type !== b.type) {
                return a.type.localeCompare(
                  b.type
                );
              }

              return a.name.localeCompare(
                b.name
              );
            }
          )
        );
      }

      setShowForm(false);
      setEditingResource(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save resource."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteResource(
    resource: Resource
  ) {
    const confirmed =
      window.confirm(
        `Delete ${resource.name}? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/guild/resources?id=${encodeURIComponent(
          resource.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to delete resource."
        );
      }

      setResources((current) =>
        current.filter(
          (item) =>
            item.id !== resource.id
        )
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete resource."
      );
    }
  }

  return (
    <>
      {/* TOOLBAR */}

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {resources.length} total resource
          {resources.length === 1 ? "" : "s"}
        </p>

        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          + Add Resource
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* FORM */}

      {showForm && (
        <ResourceForm
          resource={editingResource}
          saving={saving}
          onCancel={() => {
            setShowForm(false);
            setEditingResource(null);
          }}
          onSave={saveResource}
        />
      )}

      {/* TABLE */}

      {resources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
          <h2 className="text-xl font-semibold">
            No resources yet
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Add your first resource to get started.
          </p>

          <button
            type="button"
            onClick={openCreate}
            className="mt-6 rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200"
          >
            Add Resource
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Resource
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Type
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Total
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Per Player
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Hard Cap
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-400">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right font-medium text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800">
                {resources.map((resource) => (
                  <tr
                    key={resource.id}
                    className="transition hover:bg-zinc-800/50"
                  >
                    <td className="px-6 py-4 font-medium">
                      {resource.name}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs">
                        {
                          RESOURCE_TYPE_LABELS[
                            resource.type
                          ]
                        }
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {resource.total}
                    </td>

                    <td className="px-6 py-4">
                      {resource.perPlayerLimit}
                    </td>

                    <td className="px-6 py-4 font-medium">
                      {resource.hardCap}
                    </td>

                    <td className="px-6 py-4">
                      {resource.active ? (
                        <span className="text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <span className="text-zinc-500">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(resource)
                          }
                          className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium hover:border-zinc-500 hover:bg-zinc-800"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteResource(
                              resource
                            )
                          }
                          className="rounded-md border border-red-900 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================
// RESOURCE FORM
// =============================================================

function ResourceForm({
  resource,
  saving,
  onCancel,
  onSave,
}: {
  resource: Resource | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (data: {
    name: string;
    type: ResourceType;
    total: number;
    perPlayerLimit: number;
    hardCap: number;
    active: boolean;
  }) => void;
}) {
  const [name, setName] =
    useState(resource?.name ?? "");

  const [type, setType] =
    useState<ResourceType>(
      resource?.type ?? "FEATHER"
    );

  const [total, setTotal] =
    useState(
      resource?.total.toString() ?? ""
    );

  const [perPlayerLimit, setPerPlayerLimit] =
    useState(
      resource?.perPlayerLimit.toString() ??
        ""
    );

  const [hardCap, setHardCap] =
    useState(
      resource?.hardCap.toString() ?? ""
    );

  const [active, setActive] =
    useState(resource?.active ?? true);

  const totalNumber = Number(total);
  const perPlayerLimitNumber =
    Number(perPlayerLimit);
  const hardCapNumber =
    Number(hardCap);

  const quantitiesValid =
    Number.isInteger(totalNumber) &&
    totalNumber >= 0 &&
    Number.isInteger(
      perPlayerLimitNumber
    ) &&
    perPlayerLimitNumber >= 1 &&
    Number.isInteger(hardCapNumber) &&
    hardCapNumber >= 1 &&
    perPlayerLimitNumber <=
      hardCapNumber &&
    hardCapNumber <= totalNumber;

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!quantitiesValid) {
      return;
    }

    onSave({
      name: name.trim(),
      type,
      total: totalNumber,
      perPlayerLimit:
        perPlayerLimitNumber,
      hardCap: hardCapNumber,
      active,
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">
          {resource
            ? "Edit Resource"
            : "Add Resource"}
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Configure the resource and its allocation limits.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* NAME */}

        <div>
          <label
            htmlFor="resource-name"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Resource Name
          </label>

          <input
            id="resource-name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Feather of Strength"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
          />
        </div>

        {/* TYPE */}

        <div>
          <label
            htmlFor="resource-type"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Resource Type
          </label>

          <select
            id="resource-type"
            value={type}
            onChange={(event) =>
              setType(
                event.target.value as ResourceType
              )
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
          >
            {RESOURCE_TYPES.map(
              (resourceType) => (
                <option
                  key={resourceType}
                  value={resourceType}
                >
                  {
                    RESOURCE_TYPE_LABELS[
                      resourceType
                    ]
                  }
                </option>
              )
            )}
          </select>
        </div>

        {/* QUANTITIES */}

        <div className="grid gap-4 sm:grid-cols-3">
          {/* TOTAL */}

          <div>
            <label
              htmlFor="resource-total"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Total Quantity
            </label>

            <input
              id="resource-total"
              type="number"
              min="0"
              value={total}
              onChange={(event) =>
                setTotal(event.target.value)
              }
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
            />

            <p className="mt-1 text-xs text-zinc-500">
              Total amount available for this resource.
            </p>
          </div>

          {/* PER PLAYER */}

          <div>
            <label
              htmlFor="resource-limit"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Per Player Limit
            </label>

            <input
              id="resource-limit"
              type="number"
              min="1"
              value={perPlayerLimit}
              onChange={(event) =>
                setPerPlayerLimit(
                  event.target.value
                )
              }
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
            />

            <p className="mt-1 text-xs text-zinc-500">
              Maximum for a normal player.
            </p>
          </div>

          {/* HARD CAP */}

          <div>
            <label
              htmlFor="resource-hard-cap"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Hard Cap
            </label>

            <input
              id="resource-hard-cap"
              type="number"
              min="1"
              value={hardCap}
              onChange={(event) =>
                setHardCap(
                  event.target.value
                )
              }
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
            />

            <p className="mt-1 text-xs text-zinc-500">
              Absolute maximum one player can receive,
              including reservations.
            </p>
          </div>
        </div>

        {/* LIMIT VALIDATION */}

        {total &&
          perPlayerLimit &&
          hardCap &&
          !quantitiesValid && (
            <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-400">
              Limits must follow:
              <span className="ml-1 font-semibold">
                Per Player Limit ≤ Hard Cap ≤ Total
              </span>
            </div>
          )}

        {/* ACTIVE */}

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) =>
              setActive(event.target.checked)
            }
            className="h-4 w-4"
          />

          <span>
            <span className="block text-sm font-medium">
              Active
            </span>

            <span className="block text-xs text-zinc-500">
              Include this resource in allocation runs
            </span>
          </span>
        </label>

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
              !name.trim() ||
              !total ||
              !perPlayerLimit ||
              !hardCap ||
              !quantitiesValid
            }
            className="rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : resource
                ? "Save Changes"
                : "Add Resource"}
          </button>
        </div>
      </form>
    </section>
  );
}
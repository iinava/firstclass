"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckIcon, SaveIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useListParams } from "@/hooks/use-list-params"
import { formatDate, formatNumber } from "@/lib/format"
import { qk } from "@/lib/query-keys"
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
} from "@/validations/hrms.validation"
import type { AttendanceDayRow, LeaveListRow } from "@/lib/services/hrms.service"
import {
  decideLeave,
  fetchAttendance,
  fetchLeaves,
  saveAttendanceDay,
} from "@/app/admin/employees/actions"

const ATTENDANCE_STATUS_OPTIONS = optionsFrom(
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS
)

interface DraftEntry {
  status: string
  checkIn: string
  checkOut: string
}

export function AttendanceView() {
  const { params, setFilter } = useListParams<{ date: string }>(["date"])
  const date = params.date || new Date().toISOString().slice(0, 10)

  const { data: leaves, isLoading: leavesLoading } = useQuery({
    queryKey: qk.hrms.leaves({ status: "pending" }),
    queryFn: async () =>
      unwrapAction(
        await fetchLeaves({
          page: 1,
          pageSize: 25,
          sortDir: "desc",
          status: "pending",
        } as never)
      ),
  })

  const leaveColumns = React.useMemo<DataTableColumn<LeaveListRow>[]>(
    () => [
      {
        key: "employee",
        header: "Employee",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.employeeName}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.empCode}
            </p>
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        cell: (row) => (
          <StatusBadge status={row.type} label={LEAVE_TYPE_LABELS[row.type]} tone="info" />
        ),
      },
      {
        key: "dates",
        header: "Dates",
        cell: (row) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm">
              {formatDate(row.fromDate)} – {formatDate(row.toDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.days} day{row.days === 1 ? "" : "s"}
            </p>
          </div>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        hideOnMobile: true,
        cell: (row) => (
          <p className="max-w-xs truncate text-muted-foreground">{row.reason ?? "—"}</p>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">Decide</span>,
        className: "w-32",
        cell: (row) => <LeaveDecisionButtons leaveId={row.id} />,
      },
    ],
    []
  )

  return (
    <Tabs defaultValue="register" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="register">Daily register</TabsTrigger>
        <TabsTrigger value="leaves">
          Leave requests{leaves?.total ? ` (${leaves.total})` : ""}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="register">
        {/* Keyed by date so the unsaved draft resets when the date changes,
            rather than being cleared from an effect. */}
        <AttendanceRegister
          key={date}
          date={date}
          onDateChange={(next) => setFilter("date", next)}
        />
      </TabsContent>

      <TabsContent value="leaves">
        <DataTable
          columns={leaveColumns}
          rows={leaves?.rows}
          getRowId={(row) => row.id}
          isLoading={leavesLoading}
          emptyTitle="No pending leave requests"
          emptyDescription="Requests awaiting a decision appear here."
        />
      </TabsContent>
    </Tabs>
  )
}

function LeaveDecisionButtons({ leaveId }: { leaveId: string }) {
  const decisionMutation = useActionMutation({
    action: decideLeave,
    successMessage: "Leave updated",
    invalidate: [qk.hrms.all],
  })

  return (
    <div className="flex justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={decisionMutation.isPending}
        onClick={() =>
          decisionMutation.mutate({ id: leaveId, status: "approved" } as never)
        }
      >
        <CheckIcon data-icon="inline-start" />
        Approve
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Reject leave"
        disabled={decisionMutation.isPending}
        onClick={() =>
          decisionMutation.mutate({ id: leaveId, status: "rejected" } as never)
        }
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}

function AttendanceRegister({
  date,
  onDateChange,
}: {
  date: string
  onDateChange: (date: string) => void
}) {
  const { data: register, isLoading } = useQuery({
    queryKey: qk.hrms.attendance({ date }),
    queryFn: async () => unwrapAction(await fetchAttendance({ date })),
  })

  // Edits are held locally until "Save register" — marking twenty people one
  // request at a time would be twenty round trips and twenty toasts.
  const [draft, setDraft] = React.useState<Record<string, DraftEntry>>({})

  const entryFor = React.useCallback(
    (row: AttendanceDayRow): DraftEntry =>
      draft[row.employeeId] ?? {
        status: row.status ?? "present",
        checkIn: row.checkIn ?? "",
        checkOut: row.checkOut ?? "",
      },
    [draft]
  )

  const update = React.useCallback(
    (row: AttendanceDayRow, patch: Partial<DraftEntry>) => {
      setDraft((prev) => ({
        ...prev,
        [row.employeeId]: { ...entryFor(row), ...patch },
      }))
    },
    [entryFor]
  )

  const saveMutation = useActionMutation({
    action: saveAttendanceDay,
    successMessage: (data) =>
      `Register saved for ${(data as { count: number }).count} employees`,
    invalidate: [qk.hrms.all],
    onSuccess: () => setDraft({}),
  })

  const dirtyCount = Object.keys(draft).length

  const summary = React.useMemo(() => {
    if (!register) return { present: 0, absent: 0, unmarked: 0 }
    let present = 0
    let absent = 0
    let unmarked = 0
    for (const row of register) {
      const status = draft[row.employeeId]?.status ?? row.status
      if (!status) unmarked += 1
      else if (status === "present" || status === "half_day") present += 1
      else if (status === "absent") absent += 1
    }
    return { present, absent, unmarked }
  }, [register, draft])

  const columns = React.useMemo<DataTableColumn<AttendanceDayRow>[]>(
    () => [
      {
        key: "name",
        header: "Employee",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.empCode}
              {row.designation ? ` · ${row.designation}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        className: "w-40",
        cell: (row) => (
          <OptionSelect
            aria-label={`Attendance for ${row.name}`}
            options={ATTENDANCE_STATUS_OPTIONS}
            value={entryFor(row).status}
            onValueChange={(status) => update(row, { status })}
          />
        ),
      },
      {
        key: "checkIn",
        header: "In",
        hideOnMobile: true,
        className: "w-28",
        cell: (row) => (
          <Input
            type="time"
            aria-label={`Check in for ${row.name}`}
            value={entryFor(row).checkIn}
            onChange={(event) => update(row, { checkIn: event.target.value })}
          />
        ),
      },
      {
        key: "checkOut",
        header: "Out",
        hideOnMobile: true,
        className: "w-28",
        cell: (row) => (
          <Input
            type="time"
            aria-label={`Check out for ${row.name}`}
            value={entryFor(row).checkOut}
            onChange={(event) => update(row, { checkOut: event.target.value })}
          />
        ),
      },
      {
        key: "marked",
        header: "Saved",
        cell: (row) =>
          draft[row.employeeId] ? (
            <span className="text-xs text-amber-500">Unsaved</span>
          ) : row.status ? (
            <StatusBadge status={row.status} />
          ) : (
            <span className="text-xs text-muted-foreground">Not marked</span>
          ),
      },
    ],
    [draft, entryFor, update]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Present"
          value={formatNumber(summary.present)}
          icon={CheckIcon}
          tone="positive"
        />
        <StatCard label="Absent" value={formatNumber(summary.absent)} tone="negative" />
        <StatCard
          label="Not marked"
          value={formatNumber(summary.unmarked)}
          tone={summary.unmarked > 0 ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="attendance-date" className="text-xs text-muted-foreground">
            Date
          </label>
          <Input
            id="attendance-date"
            type="date"
            className="w-44"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>

        <Button
          disabled={dirtyCount === 0 || saveMutation.isPending}
          onClick={() => {
            const entries = Object.entries(draft).map(([employeeId, entry]) => ({
              employeeId,
              status: entry.status,
              checkIn: entry.checkIn || null,
              checkOut: entry.checkOut || null,
            }))
            saveMutation.mutate({ date, entries } as never)
          }}
        >
          {saveMutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" />
          )}
          Save register{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={register}
        getRowId={(row) => row.employeeId}
        isLoading={isLoading}
        emptyTitle="No active employees"
        emptyDescription="Add employees before marking attendance."
      />
    </div>
  )
}

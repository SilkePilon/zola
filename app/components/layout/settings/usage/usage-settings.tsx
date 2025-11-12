"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchClient } from "@/lib/fetch"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"

type ModelUsage = {
  id: string
  model_id: string
  provider_id: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_cost_usd: number | null
  output_cost_usd: number | null
  total_cost_usd: number | null
  created_at: string
  chat_id: string
  chats?: { title: string | null }
}

const formatCurrency = (amount: number | null) => {
  if (amount === null) return "N/A"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(amount)
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-US").format(num)
}

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString))
}

const columns: ColumnDef<ModelUsage>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }: any) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: any) => (
      <div className="whitespace-nowrap">
        {formatDate(row.getValue("created_at"))}
      </div>
    ),
  },
  {
    accessorKey: "model_id",
    header: ({ column }: any) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Model
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: any) => (
      <div className="font-medium">{row.getValue("model_id")}</div>
    ),
  },
  {
    accessorKey: "provider_id",
    header: ({ column }: any) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Provider
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: any) => (
      <div className="capitalize">{row.getValue("provider_id")}</div>
    ),
  },
  {
    id: "chat",
    accessorFn: (row: any) => row.chats?.title || "Untitled",
    header: ({ column }: any) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Chat
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: any) => {
      const title = row.original.chats?.title || "Untitled"
      return <div className="max-w-[200px] truncate">{title}</div>
    },
  },
  {
    accessorKey: "input_tokens",
    header: ({ column }: any) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="ml-auto h-8 px-2"
        >
          Input Tokens
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: any) => (
      <div className="text-right">{formatNumber(row.getValue("input_tokens"))}</div>
    ),
  },
  {
    accessorKey: "output_tokens",
    header: ({ column }: any) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="ml-auto h-8 px-2"
        >
          Output Tokens
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: any) => (
      <div className="text-right">{formatNumber(row.getValue("output_tokens"))}</div>
    ),
  },
  {
    accessorKey: "total_cost_usd",
    header: ({ column }: any) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="ml-auto h-8 px-2"
        >
          Cost
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: any) => (
      <div className="text-right font-medium">
        {formatCurrency(row.getValue("total_cost_usd"))}
      </div>
    ),
  },
]

export function UsageSettings() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ["model-usage"],
    queryFn: async () => {
      const response = await fetchClient("/api/model-usage")
      if (!response.ok) {
        throw new Error("Failed to fetch usage data")
      }
      return response.json()
    },
  })

  const table = useReactTable({
    data: data?.usage || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Usage & Cost</h3>
          <p className="text-muted-foreground text-sm">
            Track your model usage and associated costs
          </p>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Usage & Cost</h3>
          <p className="text-muted-foreground text-sm">
            Track your model usage and associated costs
          </p>
        </div>
        <div className="text-destructive rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          Failed to load usage data. Please try again later.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Usage & Cost</h3>
        <p className="text-muted-foreground text-sm">
          Track your model usage and associated costs
        </p>
      </div>

      {data?.totalCost !== undefined && data.totalCost > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-muted-foreground text-sm">Total Cost</div>
          <div className="text-2xl font-bold">{formatCurrency(data.totalCost)}</div>
        </div>
      )}

      <div className="w-full space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter models..."
            value={(table.getColumn("model_id")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("model_id")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column: any) => column.getCanHide())
              .map((column: any) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup: any) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header: any) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row: any) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No usage data yet. Start chatting to see your usage!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>        <div className="flex items-center justify-end space-x-2">
          <div className="text-muted-foreground flex-1 text-sm">
            {table.getFilteredRowModel().rows.length} of {data?.total || 0} row(s)
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

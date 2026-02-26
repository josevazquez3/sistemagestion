import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function HistorialSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="h-9 w-32 rounded-md bg-gray-200" />
        <div className="h-9 w-36 rounded-md bg-gray-200" />
        <div className="h-9 w-24 rounded-md bg-gray-200" />
      </div>

      {/* 3 tarjetas de totales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="h-5 w-20 rounded bg-gray-200" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla skeleton */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Año</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead className="w-16">Días</TableHead>
                <TableHead>Restantes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="h-4 w-8 rounded bg-gray-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 rounded bg-gray-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 rounded bg-gray-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-6 rounded bg-gray-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-6 rounded bg-gray-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-16 rounded-full bg-gray-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-8 w-20 rounded bg-gray-200" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Landmark, Wallet } from "lucide-react";

export default function TesoreriaPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-800">Tesorería</h1>
      <p className="text-gray-500 mt-2">Elegí un submódulo para gestionar cuentas y movimientos.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/tesoreria/cuentas-bancarias"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:bg-gray-50 hover:border-[#4CAF50]"
        >
          <Landmark className="h-8 w-8 text-[#4CAF50]" />
          <div>
            <span className="font-medium text-gray-800">Cuentas Bancarias</span>
            <p className="text-sm text-gray-500">Gestión de cuentas para clasificación de movimientos.</p>
          </div>
        </Link>
        <Link
          href="/tesoreria/extracto-banco"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:bg-gray-50 hover:border-[#4CAF50]"
        >
          <Wallet className="h-8 w-8 text-[#4CAF50]" />
          <div>
            <span className="font-medium text-gray-800">Extracto Banco</span>
            <p className="text-sm text-gray-500">Gestión e importación de movimientos bancarios.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

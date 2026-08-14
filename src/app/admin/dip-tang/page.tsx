import AdminNav from "../_components/AdminNav";
import TaxonomyManager from "../_components/TaxonomyManager";

export default function AdminOccasionsPage() { return <main className="min-h-screen bg-background px-5 py-7 sm:px-8"><div className="mx-auto max-w-7xl"><AdminNav /><TaxonomyManager kind="occasions" /></div></main>; }

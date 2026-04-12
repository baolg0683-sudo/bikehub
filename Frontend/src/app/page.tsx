"use client";

import { useMemo, useState } from "react";
import Hero from "../components/Common/Hero";
import ProductGrid from "../components/Common/ProductGrid";
import styles from "./page.module.css";

const bikeBrands = [
  "Trek",
  "Specialized",
  "Giant",
  "Cannondale",
  "Bianchi",
  "Scott",
  "Canyon",
  "Merida",
  "Colnago",
  "Pinarello",
  "BMC",
  "Orbea",
  "Santa Cruz",
  "Cube",
  "GT",
  "Felt",
  "Fuji",
  "Raleigh",
  "Mongoose",
  "Argon 18",
];

const frameMaterials = ["Carbon", "Nhôm", "Thép", "Titan", "Hợp kim"];
const conditionOptions = [
  { value: "", label: "Tất cả độ mới" },
  { value: "90", label: "90% trở lên" },
  { value: "80", label: "80% trở lên" },
  { value: "70", label: "70% trở lên" },
];

const bikeTypes = [
  "Road",
  "Mountain",
  "Gravel",
  "Hybrid",
  "City",
  "Touring",
  "E-bike",
  "Cross",
  "BMX",
];

export default function AppHome() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo(
    () => ({
      q: searchQuery,
      status: "AVAILABLE",
    }),
    [searchQuery]
  );

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const toggleFilters = () => {
    setShowFilters((current) => !current);
  };

  return (
    <div className={styles.pageHome}>
      <Hero
        searchTerm={searchInput}
        onSearchTermChange={setSearchInput}
        onSearch={handleSearch}
        onToggleFilters={toggleFilters}
        filtersOpen={showFilters}
      />
      <ProductGrid
        filters={filters}
        brands={bikeBrands}
        materials={frameMaterials}
        conditions={conditionOptions}
        types={bikeTypes}
        filtersOpen={showFilters}
      />
    </div>
  );
}

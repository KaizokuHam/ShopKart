const SearchBar = ({ search, setSearch, category, setCategory, sort, setSort }) => {
  return (
    <div className="search-toolbar mb-10 flex flex-col gap-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <input
          type="search"
          aria-label="Search products"
          placeholder="Find something good…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--coral)]"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 sm:flex-nowrap">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="w-full sm:w-auto border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--coral)] cursor-pointer"
        >
          <option value="">All Categories</option>
          <option value="Electronics">Electronics</option>
          <option value="Fashion">Fashion</option>
          <option value="Books">Books</option>
          <option value="Home">Home</option>
        </select>

        {setSort && (
          <select
            value={sort || ""}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
            className="w-full sm:w-auto border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--coral)] cursor-pointer"
          >
            <option value="">Sort: Featured</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
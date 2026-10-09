import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Star, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DISHES, fetchDishes, BACKEND_MENU, type Dish } from "@/lib/menu";
import { addToCart } from "@/lib/cart";
import grillCutout from "@/assets/menu-grill-cutout.webp";
import karahiCutout from "@/assets/menu-karahi-cutout.webp";
import biryaniCutout from "@/assets/menu-biryani-cutout.webp";
import naanCutout from "@/assets/menu-naan-cutout.webp";
import dessertCutout from "@/assets/menu-dessert-cutout.webp";

const ALL = "all";

// Presentation-only overrides: never alter the backend dish or cart record.
function menuImage(dish: Dish) {
  const name = dish.name.toLowerCase();
  if (/gulab\s*jamun/.test(name)) return dessertCutout;
  if (/naan|roghni/.test(name)) return naanCutout;
  if (/biryani|baryani|pulao/.test(name)) return biryaniCutout;
  if (/karahi|kata\s*kat/.test(name)) return karahiCutout;
  if (/boti|kabab|kebab|tikka/.test(name)) return grillCutout;
  return dish.image;
}

function categoryOf(dish: Dish) {
  return dish.categoryName || dish.tag || "Signature";
}

type MenuItemProps = {
  dish: Dish;
  index: number;
  reduce: boolean;
  onAdd: (dish: Dish) => void;
};

const CompactMenuItem = memo(function CompactMenuItem({
  dish,
  index,
  reduce,
  onAdd,
}: MenuItemProps) {
  const image = menuImage(dish);
  const isCutout = image !== dish.image;
  return (
    <motion.article
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.42, delay: Math.min(index, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="foodio-menu__item"
    >
      <Link
        to="/dish/$slug"
        params={{ slug: dish.slug }}
        aria-label={`${dish.name} — full details`}
        className="foodio-menu__image"
      >

        <motion.img
          src={image}
          alt={dish.name}
          loading="lazy"
          width={1024}
          height={1024}
          decoding="async"
          className="foodio-menu__img"
          whileInView={reduce || !isCutout ? { y: 0 } : { y: [0, -4, 0] }}
          viewport={{ amount: 0.2 }}
          whileHover={reduce ? undefined : { scale: 1.06, rotate: -2 }}
          transition={{
            y: { duration: 4.5, repeat: reduce || !isCutout ? 0 : Infinity, ease: "easeInOut", delay: (index % 5) * 0.35 },
            scale: { duration: 0.3 },
            rotate: { duration: 0.3 },
          }}
        />
      </Link>

      <div className="min-w-0">
        <Link to="/dish/$slug" params={{ slug: dish.slug }}>
          <h3 className="foodio-menu__title">
            {dish.name}
          </h3>
        </Link>

        <span className="foodio-menu__price">
          Rs {dish.price}
        </span>

        <div className="foodio-menu__rating" aria-label="Five stars">
          {[0, 1, 2, 3, 4].map((star) => (
            <Star key={star} className="fill-current" aria-hidden="true" />
          ))}
        </div>

        <div className="foodio-menu__actions">
          <Link
            to="/dish/$slug"
            params={{ slug: dish.slug }}
            className="foodio-menu__details"
          >
            <Eye aria-hidden="true" />
            <span>View Details</span>
          </Link>
          <Button
            type="button"
            aria-label={`Add ${dish.name} to cart`}
            onClick={() => onAdd(dish)}
            className="foodio-menu__cart"
          >
            <ShoppingBag className="foodio-menu__bag" aria-hidden="true" />
            <span>Add to Cart</span>
          </Button>
        </div>
      </div>
    </motion.article>
  );
});

function MenuSkeleton() {
  return (
    <div className="foodio-menu__grid" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="foodio-menu__item">

          <div className="menu-skeleton__block h-12 w-4/5" />
          <div className="py-2">
            <div className="menu-skeleton__block mt-2 h-7 w-1/2" />
            <div className="menu-skeleton__block mt-3 h-4 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MenuShowcase() {
  const reduce = !!useReducedMotion();
  const [active, setActive] = useState(ALL);

  const { data: dishes = BACKEND_MENU ? [] : DISHES, isLoading } = useQuery({
    queryKey: ["menu-dishes"],
    queryFn: () => fetchDishes(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const handleCategorySelect = (event: Event) => {
      const category = (event as CustomEvent<string>).detail;
      if (category) setActive(category);
    };
    window.addEventListener("menu-category-select", handleCategorySelect);
    return () => window.removeEventListener("menu-category-select", handleCategorySelect);
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    dishes.forEach((dish) => {
      const category = categoryOf(dish);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [dishes]);

  const visible = useMemo(
    () => (active === ALL ? dishes : dishes.filter((dish) => categoryOf(dish) === active)),
    [active, dishes],
  );

  const handleAdd = useCallback((dish: Dish) => {
    addToCart(dish.slug, "Regular", 1);
    toast.success(`${dish.name} cart mein add ho gaya`, {
      description: "Cart se ek hi jagah pura order place karein.",
    });
  }, []);

  return (
    <section id="menu" className="foodio-menu">
      <div className="foodio-menu__container">
        <motion.header
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="foodio-menu__heading"
        >
          <span className="foodio-menu__eyebrow">Pick your craving</span>
          <h2>Our Menu</h2>
        </motion.header>


        <nav className="foodio-menu__filters" aria-label="Menu categories">
          {[{ name: ALL, count: dishes.length }, ...categories].map((category) => {
            const selected = active === category.name;
            return (
              <Button
                key={category.name}
                type="button"
                variant="ghost"
                aria-pressed={selected}
                onClick={() => setActive(category.name)}
                className={`foodio-menu__filter ${selected ? "foodio-menu__filter--active" : ""}`}
              >
                {selected && (
                  <motion.span
                    layoutId="menu-filter-pill"
                    className="foodio-menu__pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span>{category.name === ALL ? "All" : category.name}</span>
                <span className="foodio-menu__count">{category.count}</span>
              </Button>
            );
          })}
        </nav>

        <div aria-live="polite">
          {isLoading ? (
            <MenuSkeleton />
          ) : (
            <motion.div
              key={active}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="foodio-menu__grid"
            >
              {visible.map((dish, index) => (
                <CompactMenuItem
                  key={dish.slug}
                  dish={dish}
                  index={index}
                  reduce={reduce}
                  onAdd={handleAdd}
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
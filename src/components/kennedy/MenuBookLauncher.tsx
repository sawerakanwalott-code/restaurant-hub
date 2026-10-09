import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { MenuBook } from "./MenuBook";

export function MenuBookLauncher({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="menu-book-overlay" />
        <DialogPrimitive.Content className="menu-book-viewer">
          <div className="menu-book-viewer__header">
            <div><DialogTitle className="menu-book-viewer__title">Kennedy Menu Book</DialogTitle><DialogDescription className="menu-book-viewer__subtitle">Moon Grill · Narowal</DialogDescription></div>
            <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close menu book" className="menu-book-viewer__close"><X /></Button></DialogClose>
          </div>
          <MenuBook />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
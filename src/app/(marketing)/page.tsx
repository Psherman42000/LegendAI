import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { Comparison } from "@/components/marketing/Comparison";
import { Pricing } from "@/components/marketing/Pricing";
import { Testimonials } from "@/components/marketing/Testimonials";
import { Demo } from "@/components/marketing/Demo";
import { Footer } from "@/components/layout/Footer";

export default function MarketingPage() {
  return (
    <main className="bg-[var(--bg)] text-[var(--text)]">
      <Hero />
      <Features />
      <Comparison />
      <Pricing />
      <Testimonials />
      <Demo />
      <Footer />
    </main>
  );
}

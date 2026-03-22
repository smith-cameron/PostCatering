import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConfirmReviewList from "./ConfirmReviewList";

describe("ConfirmReviewList", () => {
  it("stacks separated review values into individual lines", () => {
    render(
      <ConfirmReviewList
        rows={[
          {
            label: "Included Items",
            value: "Bread | Salad | Dessert",
          },
        ]}
      />
    );

    expect(screen.getByText("Included Items")).toBeInTheDocument();
    expect(screen.getByText("Bread")).toBeInTheDocument();
    expect(screen.getByText("Salad")).toBeInTheDocument();
    expect(screen.getByText("Dessert")).toBeInTheDocument();
    expect(screen.queryByText("Bread | Salad | Dessert")).not.toBeInTheDocument();
  });
});

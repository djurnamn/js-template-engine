import React from "react";

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = (props) => {
  return (
    <button
      type="button"
      className="button button--primary button button--primary"
      onClick={() => alert("Clicked!")}
    >
      Click me
    </button>
  );
};

export default Button;

import React from "react"; const TemplateLogicDemo = (props) => { return ( {/*
This demo shows all the template logic node types */}<React.Fragment
  ><h1>Template Logic Demo</h1>
  {/* Conditional section */}{props.showAdvanced ? (
  <section className="advanced-section">
    <h2>Advanced Features</h2>
    {items.map((item, index) => (
    <div className="item-card">{/* Item details */}<span>Item name</span></div>
    ))}
  </section>
  ) : (
  <p>Enable advanced mode to see more features</p>
  )}</React.Fragment
>
); }; export default TemplateLogicDemo;

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("OwneraERC20TestTokenModule", (m) => {
  const defaultAdmin = m.getParameter("defaultAdmin");
  const minter = m.getParameter("minter");

  const token = m.contract("OwneraERC20TestToken", [defaultAdmin, minter]);

  return { token };
});

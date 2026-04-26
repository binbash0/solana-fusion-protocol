import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { FusionSwap } from "../../target/types/fusion_swap";
import { TestState } from "../utils/utils";
import { BankrunProvider } from "anchor-bankrun";
import { expect } from "chai";

describe("Unfillable order PoC", () => {
  it("fails to fill when protocol_fee + integrator_fee > 100%", async () => {
    const context = await TestState.bankrunContext([]);
    const provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    const program = new anchor.Program<FusionSwap>(
      require("../../target/idl/fusion_swap.json"),
      provider
    );
    const state = await TestState.bankrunCreate(context, context.payer, [], { tokensNums: 2 });

    const orderConfig = state.orderConfig({
      fee: {
        protocolFee: 60000,
        integratorFee: 60000,
        surplusPercentage: 0,
        maxCancellationPremium: new anchor.BN(0),
        protocolDstAcc: state.charlie.atas[state.tokens[1].toString()].address,
        integratorDstAcc: state.dave.atas[state.tokens[1].toString()].address,
      },
    });

    const escrow = await state.createEscrow({
      escrowProgram: program,
      payer: context.payer,
      provider: provider,
      orderConfig,
    });

    await expect(
      program.methods
        .fill(escrow.orderConfig, state.defaultSrcAmount)
        .accountsPartial(state.buildAccountsDataForFill({
          escrow: escrow.escrow,
          escrowSrcAta: escrow.ata,
          protocolDstAcc: state.charlie.atas[state.tokens[1].toString()].address,
          integratorDstAcc: state.dave.atas[state.tokens[1].toString()].address,
        }))
        .signers([state.bob.keypair])
        .rpc()
    ).to.be.rejectedWith("ArithmeticOverflow");
  });
});

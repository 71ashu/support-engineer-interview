"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc/client";
import { isValidCardNumber } from "@/lib/utils/validation";

interface FundingModalProps {
  accountId: number;
  onClose: () => void;
  onSuccess: () => void;
}

type FundingFormData = {
  amount: string;
  fundingType: "card" | "bank";
  accountNumber: string;
  routingNumber?: string;
};

export function FundingModal({ accountId, onClose, onSuccess }: FundingModalProps) {
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  const {
    register,
    handleSubmit,
    watch,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FundingFormData>({
    defaultValues: {
      fundingType: "card",
    },
    mode: "onChange", // Validate on change for better UX
  });

  const fundingType = watch("fundingType");
  const fundAccountMutation = trpc.account.fundAccount.useMutation();

  // Re-validate account number when funding type changes
  useEffect(() => {
    trigger("accountNumber");
  }, [fundingType, trigger]);

  const onSubmit = async (data: FundingFormData) => {
    setError("");

    try {
      const amount = parseFloat(data.amount);

      await fundAccountMutation.mutateAsync({
        accountId,
        amount,
        fundingSource: {
          type: data.fundingType,
          accountNumber: data.accountNumber,
          routingNumber: data.routingNumber,
        },
      });

      // Ensure account data and transaction history are refreshed after a successful funding
      await Promise.all([
        utils.account.getAccounts.invalidate(),
        utils.account.getTransactions.invalidate({ accountId }),
      ]);

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to fund account");
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Fund Your Account</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                {...register("amount", {
                  required: "Amount is required",
                  pattern: {
                  // Disallow multiple leading zeros in the integer part.
                  // Valid examples: "0.50", "5", "5.25", "10.00"
                  // Invalid examples: "00.50", "0005", "01.00"
                  value: /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/,
                  message: "Invalid amount format",
                  },
                  min: {
                    value: 0.01,
                    message: "Amount must be at least $0.01",
                  },
                  max: {
                    value: 10000,
                    message: "Amount cannot exceed $10,000",
                  },
                })}
                type="text"
                className="pl-7 block w-full rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
                placeholder="0.00"
              />
            </div>
            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Funding Source</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input {...register("fundingType")} type="radio" value="card" className="mr-2" />
                <span>Credit/Debit Card</span>
              </label>
              <label className="flex items-center">
                <input {...register("fundingType")} type="radio" value="bank" className="mr-2" />
                <span>Bank Account</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {fundingType === "card" ? "Card Number" : "Account Number"}
            </label>
            <input
              {...register("accountNumber", {
                required: `${fundingType === "card" ? "Card" : "Account"} number is required`,
                validate: {
                  format: (value) => {
                    // Get current funding type to ensure we have the latest value
                    const currentFundingType = getValues("fundingType");
                    if (currentFundingType === "card") {
                      // Allow digits, spaces, and dashes for card numbers
                      const cleaned = value.replace(/\s|-/g, "");
                      if (!/^\d{13,19}$/.test(cleaned)) {
                        return "Card number must be 13-19 digits";
                      }
                    } else {
                      // For bank accounts, just digits
                      if (!/^\d+$/.test(value)) {
                        return "Invalid account number";
                      }
                    }
                    return true;
                  },
                  validCard: (value) => {
                    // Get current funding type to ensure we have the latest value
                    const currentFundingType = getValues("fundingType");
                    if (currentFundingType !== "card") return true;
                    if (!isValidCardNumber(value)) {
                      return "Invalid card number. Please check the number and try again.";
                    }
                    return true;
                  },
                },
              })}
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
              placeholder={fundingType === "card" ? "1234 5678 9012 3456" : "123456789"}
            />
            {errors.accountNumber && <p className="mt-1 text-sm text-red-600">{errors.accountNumber.message}</p>}
          </div>

          {fundingType === "bank" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Routing Number</label>
              <input
                {...register("routingNumber", {
                  required: "Routing number is required",
                  pattern: {
                    value: /^\d{9}$/,
                    message: "Routing number must be 9 digits",
                  },
                })}
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:border-gray-600 dark:placeholder-gray-400"
                placeholder="123456789"
              />
              {errors.routingNumber && <p className="mt-1 text-sm text-red-600">{errors.routingNumber.message}</p>}
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fundAccountMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {fundAccountMutation.isPending ? "Processing..." : "Fund Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

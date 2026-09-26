from airllm import AutoModel

MAX_LENGTH = 128
MODEL_ID = "garage-bAInd/Platypus2-70B-instruct"


def main() -> None:
    model = AutoModel.from_pretrained(MODEL_ID)

    input_text = ["What is the capital of the United States?"]
    input_tokens = model.tokenizer(
        input_text,
        return_tensors="pt",
        return_attention_mask=False,
        truncation=True,
        max_length=MAX_LENGTH,
        padding=False,
    )

    generation_output = model.generate(
        input_tokens["input_ids"].cuda(),
        max_new_tokens=20,
        use_cache=True,
        return_dict_in_generate=True,
    )

    output = model.tokenizer.decode(generation_output.sequences[0])
    print(output)


if __name__ == "__main__":
    main()

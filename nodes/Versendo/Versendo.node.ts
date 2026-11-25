import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

// Programmatic style instead of declarative: the PDF and attachment operations read binary data
// from incoming items and convert it to base64, which declarative routing cannot do.

const LETTER_TYPES = [
	{ name: 'Cancellation of a Contract (Kündigung Vertrag)', value: 'kuendigung_vertrag' },
	{ name: 'Complaint (Reklamation)', value: 'reklamation' },
	{
		name: 'Dunning Letter or Payment Reminder (Mahnung)',
		value: 'mahnung_oder_zahlungserinnerung',
	},
	{ name: 'Leaving a Club (Vereinsaustritt)', value: 'vereinsaustritt' },
	{ name: 'Objection to an Authority (Widerspruch Behörde)', value: 'widerspruch_behoerde' },
	{ name: 'Objection, Other (Widerspruch Sonstiges)', value: 'widerspruch_sonstiges' },
	{ name: 'Other (Sonstiges)', value: 'sonstiges' },
];

const SEND_OPERATIONS = ['sendText', 'sendPdf'];
const showFor = (operation: string[]) => ({
	show: { resource: ['letter'], operation },
});

const addressFields: INodeProperties[] = [
	{
		displayName: 'Sender Name',
		name: 'senderName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Studio Mustermann GmbH',
		description: 'Name of the sender, printed in the return address line',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Sender Street',
		name: 'senderStreet',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Lindenstraße 12',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Sender Postal Code',
		name: 'senderPostalCode',
		type: 'string',
		required: true,
		default: '',
		placeholder: '80331',
		description:
			'Five digits in Germany. If the sender lives abroad, set Sender Country under Additional Fields.',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Sender City',
		name: 'senderCity',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'München',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Recipient Name',
		name: 'recipientName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Müller GmbH',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Recipient Street',
		name: 'recipientStreet',
		type: 'string',
		default: '',
		placeholder: 'Hauptstraße 5',
		description:
			'Street and house number. Can stay empty for a PO box address with its own postal code.',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Recipient Postal Code',
		name: 'recipientPostalCode',
		type: 'string',
		required: true,
		default: '',
		placeholder: '10115',
		description: 'Five digits. Recipients must be in Germany.',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Recipient City',
		name: 'recipientCity',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Berlin',
		displayOptions: showFor(SEND_OPERATIONS),
	},
];

const letterFields: INodeProperties[] = [
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Zahlungserinnerung zur Rechnung RE-2026-114',
		description: 'Subject line, without the word "Betreff"',
		displayOptions: showFor(['sendText']),
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 8 },
		placeholder:
			'Sehr geehrte Damen und Herren,\n\n…\n\nMit freundlichen Grüßen\n\nStudio Mustermann GmbH',
		description:
			'Only the body: salutation, content, closing and the sender name below it. No addresses, subject or date, Versendo places those itself. Separate paragraphs with an empty line.',
		displayOptions: showFor(['sendText']),
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the PDF',
		description:
			'A4 portrait, at most 8 pages. The recipient address must sit in the DIN 5008 window, or turn on Add Cover Page.',
		displayOptions: showFor(['sendPdf']),
	},
	{
		displayName: 'Add Cover Page',
		name: 'coverPage',
		type: 'boolean',
		default: false,
		description:
			'Whether Versendo should put a page with the address in the window in front of your PDF (one extra page). Turn on if your PDF layout does not match the envelope window.',
		displayOptions: showFor(['sendPdf']),
	},
	{
		displayName: 'Letter Type',
		name: 'letterType',
		type: 'options',
		options: LETTER_TYPES,
		default: 'mahnung_oder_zahlungserinnerung',
		description:
			'What kind of letter this is. Versendo checks formal requirements based on it and refuses letters that legally need a handwritten signature.',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Registered Mail',
		name: 'registeredMail',
		type: 'boolean',
		default: false,
		description:
			'Whether to send as Einwurf-Einschreiben with a Deutsche Post tracking number, useful as proof of delivery for dunning letters and deadlines',
		displayOptions: showFor(SEND_OPERATIONS),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(SEND_OPERATIONS),
		options: [
			{
				displayName: 'Attachment Binary Fields',
				name: 'attachmentBinaryFields',
				type: 'string',
				default: '',
				placeholder: 'invoice, contract',
				description:
					'Comma-separated names of input binary fields to print behind the letter (PDF, JPG or PNG, up to 5 files). Whole request at most about 3 MB of files.',
			},
			{
				displayName: 'Attachment Names',
				name: 'attachmentNames',
				type: 'string',
				default: '',
				placeholder: 'Rechnungskopie',
				description:
					'Text letters only: comma-separated names for the "Anlagen" note below the text, e.g. Rechnungskopie',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				placeholder: 'RE-2026-114-stage-2',
				description:
					'Your own unique ID, e.g. invoice number plus dunning stage. The same key never creates a second letter, even if the workflow runs again.',
			},
			{
				displayName: 'Recipient Additional Line',
				name: 'recipientAdditionalLine',
				type: 'string',
				default: '',
				placeholder: 'Buchhaltung',
				description: 'Second address line, e.g. department or c/o',
			},
			{
				displayName: 'References',
				name: 'references',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, maxValue: 4 },
				default: {},
				placeholder: 'Add Reference',
				description: 'Text letters only: shown top right, e.g. customer or invoice number',
				options: [
					{
						displayName: 'Reference',
						name: 'reference',
						values: [
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
								placeholder: 'Rechnungsnummer',
								description: 'At most 25 characters',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'RE-2026-114',
								description: 'At most 35 characters',
							},
						],
					},
				],
			},
			{
				displayName: 'Sender Country',
				name: 'senderCountry',
				type: 'string',
				default: '',
				placeholder: 'Österreich',
				description: 'Only if the sender does not live in Germany. Leave empty for Germany.',
			},
			{
				displayName: 'Subject (PDF Letters)',
				name: 'pdfSubject',
				type: 'string',
				default: '',
				description: 'PDF letters only: subject for your overview and proof, not printed',
			},
		],
	},
];

const getFields: INodeProperties[] = [
	{
		displayName: 'Letter ID',
		name: 'letterId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID returned when the letter was created',
		displayOptions: showFor(['get']),
	},
];

function splitList(value: string): string[] {
	return value
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

async function versendoRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	headers: IDataObject = {},
): Promise<IDataObject> {
	const credentials = await this.getCredentials('versendoApi', itemIndex);
	const baseUrl = String(credentials.baseUrl || 'https://versendo.de').replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		headers: { Accept: 'application/json', ...headers },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body) options.body = body;

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'versendoApi',
		options,
	)) as IN8nHttpFullResponse;
	const data = (response.body ?? {}) as IDataObject;

	if (response.statusCode >= 400) {
		const error = (data.fehler ?? {}) as IDataObject;
		const details: string[] = [];
		if (Array.isArray(error.felder)) {
			for (const field of error.felder as IDataObject[])
				details.push(`${field.feld}: ${field.meldung}`);
		}
		if (error.tipp) details.push(String(error.tipp));
		if (error.aufladen_url) details.push(`Top up your balance: ${error.aufladen_url}`);
		throw new NodeApiError(this.getNode(), data as JsonObject, {
			message: String(error.meldung ?? `Versendo answered with status ${response.statusCode}`),
			description: details.join('\n') || undefined,
			httpCode: String(response.statusCode),
			itemIndex,
		});
	}
	return data;
}

async function binaryAsFile(
	this: IExecuteFunctions,
	itemIndex: number,
	propertyName: string,
): Promise<{ name: string; inhalt_base64: string }> {
	const binary = this.helpers.assertBinaryData(itemIndex, propertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);
	return {
		name: (binary.fileName ?? `${propertyName}.${binary.fileExtension ?? 'pdf'}`).slice(0, 80),
		inhalt_base64: buffer.toString('base64'),
	};
}

export class Versendo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Versendo',
		name: 'versendo',
		icon: { light: 'file:versendo.svg', dark: 'file:versendo.dark.svg' },
		group: ['output'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send real paper letters by Deutsche Post to addresses in Germany',
		defaults: {
			name: 'Versendo',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'versendoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Letter', value: 'letter' },
					{ name: 'Price', value: 'price' },
				],
				default: 'letter',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['letter'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description:
							'Get the status of a letter, including the tracking number for registered mail',
						action: 'Get a letter',
					},
					{
						name: 'Send PDF',
						value: 'sendPdf',
						description:
							'Print and post your own PDF, e.g. a dunning letter from your accounting software',
						action: 'Send a PDF as a letter',
					},
					{
						name: 'Send Text',
						value: 'sendText',
						description: 'Versendo lays out the letter according to DIN 5008, prints and posts it',
						action: 'Send a letter from text',
					},
				],
				default: 'sendText',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['price'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get current prices per letter',
						action: 'Get prices',
					},
				],
				default: 'get',
			},
			{
				displayName:
					'With a test key (vs_test_…) nothing is printed or charged. With a live key (vs_live_…) the letter is paid from your Versendo balance and really posted.',
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: showFor(SEND_OPERATIONS),
			},
			...addressFields,
			...letterFields,
			...getFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: IDataObject;

				if (resource === 'price' && operation === 'get') {
					responseData = await versendoRequest.call(this, i, 'GET', '/v1/preise');
				} else if (resource === 'letter' && operation === 'get') {
					const letterId = (this.getNodeParameter('letterId', i) as string).trim();
					if (!letterId)
						throw new NodeOperationError(this.getNode(), 'Letter ID is empty', { itemIndex: i });
					responseData = await versendoRequest.call(
						this,
						i,
						'GET',
						`/v1/briefe/${encodeURIComponent(letterId)}`,
					);
				} else if (resource === 'letter' && SEND_OPERATIONS.includes(operation)) {
					const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

					const sender: IDataObject = {
						name: this.getNodeParameter('senderName', i) as string,
						strasse: this.getNodeParameter('senderStreet', i) as string,
						plz: String(this.getNodeParameter('senderPostalCode', i)).trim(),
						ort: this.getNodeParameter('senderCity', i) as string,
					};
					if (extra.senderCountry) sender.land = extra.senderCountry;

					const recipient: IDataObject = {
						name: this.getNodeParameter('recipientName', i) as string,
						plz: String(this.getNodeParameter('recipientPostalCode', i)).trim(),
						ort: this.getNodeParameter('recipientCity', i) as string,
					};
					const street = (this.getNodeParameter('recipientStreet', i, '') as string).trim();
					if (street) recipient.strasse = street;
					if (extra.recipientAdditionalLine) recipient.zusatz = extra.recipientAdditionalLine;

					const body: IDataObject = {
						absender: sender,
						empfaenger: recipient,
						briefart: this.getNodeParameter('letterType', i) as string,
						einschreiben: (this.getNodeParameter('registeredMail', i) as boolean)
							? 'einwurf'
							: 'nein',
					};

					if (operation === 'sendText') {
						body.betreff = this.getNodeParameter('subject', i) as string;
						body.text = this.getNodeParameter('text', i) as string;
						const references = ((extra.references as IDataObject)?.reference ??
							[]) as IDataObject[];
						const filled = references.filter((r) => r.label && r.value);
						if (filled.length)
							body.referenzen = filled.map((r) => ({ bezeichnung: r.label, wert: r.value }));
						const names = splitList(String(extra.attachmentNames ?? ''));
						if (names.length) body.anlagen = names;
					} else {
						const property = this.getNodeParameter('binaryPropertyName', i) as string;
						body.pdf_base64 = (await binaryAsFile.call(this, i, property)).inhalt_base64;
						body.deckblatt = this.getNodeParameter('coverPage', i) as boolean;
						if (extra.pdfSubject) body.betreff = extra.pdfSubject;
					}

					const attachmentFields = splitList(String(extra.attachmentBinaryFields ?? ''));
					if (attachmentFields.length) {
						const files = [];
						for (const field of attachmentFields)
							files.push(await binaryAsFile.call(this, i, field));
						body.anlagen_dateien = files;
					}

					const headers: IDataObject = {};
					if (extra.idempotencyKey)
						headers['Idempotency-Key'] = String(extra.idempotencyKey).trim();

					responseData = await versendoRequest.call(this, i, 'POST', '/v1/briefe', body, headers);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex: i },
					);
				}

				returnData.push({ json: responseData, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					const failure: IDataObject = { error: (error as Error).message };
					if (error instanceof NodeApiError) {
						if (error.description) failure.description = error.description;
						if (error.httpCode) failure.httpCode = error.httpCode;
					}
					returnData.push({ json: failure, pairedItem: { item: i } });
					continue;
				}
				// Both constructors hand back an error that is already of their type unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
